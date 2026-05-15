import os
import base64
import csv
import json
import mysql.connector
import smtplib
import time
import threading
import traceback
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders
from datetime import date
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
 
from pathlib import Path
load_dotenv(dotenv_path=Path(__file__).parent / ".env")
 
# ── Config ────────────────────────────────────────────────────
GMAIL_ADDRESS  = os.getenv("GMAIL_ADDRESS")
GMAIL_PASSWORD = os.getenv("GMAIL_PASSWORD")
SCOPES         = ['https://www.googleapis.com/auth/gmail.modify']
DOWNLOAD_DIR   = 'attachments'
CHECK_INTERVAL = 30
 
DB_CONFIG = {
    "host":     os.getenv("DB_HOST"),
    "port":     int(os.getenv("DB_PORT", 3306)),
    "user":     os.getenv("DB_USER"),
    "password": os.getenv("DB_PASSWORD"),
    "database": os.getenv("DB_NAME"),
    "use_pure": True
}
 
# ── File-based storage ────────────────────────────────────────
RFQS_FILE   = 'rfqs.json'
QUOTES_FILE = 'quotes.json'
 
def get_all_rfqs():
    conn   = mysql.connector.connect(**DB_CONFIG)
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT * FROM rfqs")
    rows   = cursor.fetchall()
    cursor.close(); conn.close()
    for row in rows:
        row['items'] = json.loads(row['items']) if row['items'] else []
    return rows

def save_rfq(rfq):
    conn   = mysql.connector.connect(**DB_CONFIG)
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO rfqs (sender, sender_email, subject, items, parts_count, status, date) VALUES (%s,%s,%s,%s,%s,%s,%s)",
        (rfq['sender'], rfq['sender_email'], rfq['subject'],
         json.dumps(rfq['items']), rfq['parts_count'], rfq['status'], rfq['date'])
    )
    conn.commit()
    new_id = cursor.lastrowid
    cursor.close(); conn.close()
    return new_id

def update_rfq_status(rfq_id, status):
    conn   = mysql.connector.connect(**DB_CONFIG)
    cursor = conn.cursor()
    cursor.execute("UPDATE rfqs SET status=%s WHERE id=%s", (status, rfq_id))
    conn.commit()
    cursor.close(); conn.close()

def get_all_quotes():
    conn   = mysql.connector.connect(**DB_CONFIG)
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT * FROM quotes")
    rows   = cursor.fetchall()
    cursor.close(); conn.close()
    for row in rows:
        row['items']             = json.loads(row['items']) if row['items'] else []
        row['unavailable_items'] = json.loads(row['unavailable_items']) if row['unavailable_items'] else []
    return rows

def save_quote(quote):
    conn   = mysql.connector.connect(**DB_CONFIG)
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO quotes (rfq_id, recipient, items, unavailable_items, grand_total, status, created_at) VALUES (%s,%s,%s,%s,%s,%s,%s)",
        (quote['rfq_id'], quote['recipient'], json.dumps(quote['items']),
         json.dumps(quote.get('unavailable_items', [])),
         quote['grand_total'], quote['status'], quote['created_at'])
    )
    conn.commit()
    new_id = cursor.lastrowid
    cursor.close(); conn.close()
    return new_id

def update_quote_status(quote_id, status):
    conn   = mysql.connector.connect(**DB_CONFIG)
    cursor = conn.cursor()
    cursor.execute("UPDATE quotes SET status=%s WHERE id=%s", (status, quote_id))
    conn.commit()
    cursor.close(); conn.close()
 
# ── FastAPI app ───────────────────────────────────────────────
app = FastAPI()
 
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "https://uptool-proj-hl8kk77pt-kavita-bhutada-s-projects.vercel.app",
        "https://*.vercel.app",  # covers all vercel preview URLs
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)
 
# ── 1. Gmail authentication ───────────────────────────────────
def authenticate():
    creds = None
    if os.path.exists('token.json'):
        creds = Credentials.from_authorized_user_file('token.json', SCOPES)
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file('credentials.json', SCOPES)
            creds = flow.run_local_server(port=0)
        with open('token.json', 'w') as token:
            token.write(creds.to_json())
    return build('gmail', 'v1', credentials=creds)
 
# ── 2. Check for new unread Quotation emails ──────────────────
def get_new_quotation_emails(service):
    results = service.users().messages().list(
        userId='me',
        q='subject:quotation has:attachment is:unread'
    ).execute()
    return results.get('messages', [])
 
# ── 3. Download CSV attachment + get sender ───────────────────
def process_email(service, msg_id):
    message = service.users().messages().get(
        userId='me', id=msg_id, format='full'
    ).execute()
 
    headers  = message['payload'].get('headers', [])
    sender   = next((h['value'] for h in headers if h['name'] == 'From'), None)
    subject  = next((h['value'] for h in headers if h['name'] == 'Subject'), '')
 
    print(f"📧 New email from : {sender}")
    print(f"   Subject        : {subject}")
 
    csv_path = None
    parts = message['payload'].get('parts', [])
    os.makedirs(DOWNLOAD_DIR, exist_ok=True)
 
    for part in parts:
        filename = part.get('filename', '')
        if filename.endswith('.csv'):
            att_id = part['body'].get('attachmentId')
            if att_id:
                attachment = service.users().messages().attachments().get(
                    userId='me', messageId=msg_id, id=att_id
                ).execute()
                data = base64.urlsafe_b64decode(attachment['data'])
                csv_path = os.path.join(DOWNLOAD_DIR, filename)
                with open(csv_path, 'wb') as f:
                    f.write(data)
                print(f"✅ Attachment saved : {csv_path}")
 
    service.users().messages().modify(
        userId='me',
        id=msg_id,
        body={'removeLabelIds': ['UNREAD']}
    ).execute()
 
    return sender, csv_path
 
# ── 4. Read CSV attachment ────────────────────────────────────
def read_csv(filepath):
    items = []
    with open(filepath, newline='') as f:
        reader = csv.DictReader(f)
        reader.fieldnames = [col.strip().lower() for col in reader.fieldnames]
        name_col     = next((col for col in reader.fieldnames if 'name' in col), None)
        quantity_col = next((col for col in reader.fieldnames if 'qty' in col or 'quantity' in col), None)
 
        if not name_col or not quantity_col:
            print("❌ Could not find name/quantity columns in CSV.")
            return []
 
        for row in reader:
            row      = {k.strip().lower(): v.strip() for k, v in row.items()}
            name     = row.get(name_col, '').strip()
            quantity = row.get(quantity_col, '0').strip()
            if name and quantity:
                items.append({'name': name, 'quantity': int(quantity)})
    return items
 
# ── 5. Fetch prices from MySQL ────────────────────────────────
def fetch_prices(items):
    conn   = mysql.connector.connect(**DB_CONFIG)
    cursor = conn.cursor()
    enriched = []
    for item in items:
        cursor.execute(
            "SELECT name, price FROM manufacturing_parts WHERE name = %s",
            (item['name'],)
        )
        result = cursor.fetchone()
        if result:
            price    = float(result[1])
            quantity = item['quantity']
            enriched.append({
                'name'      : item['name'],
                'quantity'  : quantity,
                'unit_price': price,
                'total'     : price * quantity
            })
        else:
            print(f"⚠️  Product not found in DB: {item['name']}")
    cursor.close()
    conn.close()
    return enriched 
# ── 6. Generate quotation CSV ─────────────────────────────────
def generate_csv(enriched_items, output_file='quotation.csv', unavailable_items=None):
    with open(output_file, 'w', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(['QUOTATION'])
        writer.writerow([f'Date: {date.today().strftime("%d %B %Y")}'])
        writer.writerow([])
        writer.writerow(['#', 'Product Name', 'Quantity', 'Unit Price', 'Total'])

        grand_total = 0
        for i, item in enumerate(enriched_items, start=1):
            writer.writerow([
                i,
                item['name'],
                item['quantity'],
                f"{item['unit_price']:.2f}",
                f"{item['total']:.2f}"
            ])
            grand_total += item['total']

        writer.writerow([])
        writer.writerow(['', '', '', 'Grand Total', f"{grand_total:.2f}"])

        # Add unavailable items section
        if unavailable_items:
            writer.writerow([])
            writer.writerow(['--- UNAVAILABLE ITEMS ---'])
            writer.writerow(['#', 'Product Name', 'Quantity', 'Status'])
            for i, item in enumerate(unavailable_items, start=1):
                writer.writerow([i, item['name'], item['quantity'], 'Not Available'])

    print(f"✅ Quotation CSV generated : {output_file}")
    return output_file 
# ── 7. Send email ─────────────────────────────────────────────
def send_email(to_address, csv_file, unavailable_items=None):
    msg            = MIMEMultipart()
    msg['From']    = GMAIL_ADDRESS
    msg['To']      = to_address
    msg['Subject'] = "Quotation - Price Details"

    # Build unavailable items text
    unavailable_text = ""
    if unavailable_items:
        unavailable_text = "\n\nPlease note the following items are currently NOT AVAILABLE:\n"
        for item in unavailable_items:
            unavailable_text += f"  • {item['name']} (Qty: {item['quantity']})\n"
        unavailable_text += "\nWe apologize for the inconvenience. Please contact us for alternatives or updated availability."

    body = f"""Dear Sir/Madam,

Please find attached the quotation with pricing details for your requested items.{unavailable_text}

Should you have any questions, feel free to reach out.

Best regards"""

    msg.attach(MIMEText(body, 'plain'))

    with open(csv_file, 'rb') as f:
        part = MIMEBase('application', 'octet-stream')
        part.set_payload(f.read())
        encoders.encode_base64(part)
        part.add_header('Content-Disposition',
                        f'attachment; filename={os.path.basename(csv_file)}')
        msg.attach(part)

    with smtplib.SMTP_SSL('smtp.gmail.com', 465) as server:
        server.login(GMAIL_ADDRESS, GMAIL_PASSWORD)
        server.sendmail(GMAIL_ADDRESS, to_address, msg.as_string())

    print(f"✅ Quotation emailed to : {to_address}") 
# ── API Routes ────────────────────────────────────────────────
 
@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/debug/env")        # ← add this block right here
def debug_env():
    return {
        "DB_HOST":     os.getenv("DB_HOST"),
        "DB_PORT":     os.getenv("DB_PORT"),
        "DB_USER":     os.getenv("DB_USER"),
        "DB_PASSWORD": "SET" if os.getenv("DB_PASSWORD") else "NOT SET",
        "DB_NAME":     os.getenv("DB_NAME"),
    }
 
@app.post("/mail/fetch")
def fetch_emails():
    try:
        service  = authenticate()
        messages = get_new_quotation_emails(service)
        count    = 0
        for msg in messages:
            sender, csv_path = process_email(service, msg['id'])
            if csv_path and sender:
                items = read_csv(csv_path)
                rfq   = {
                    'sender':      sender,
                    'sender_email':sender,
                    'subject':     'Quotation Request',
                    'items':       items,
                    'parts_count': len(items),
                    'status':      'new',
                    'date':        str(date.today())
                }
                save_rfq(rfq)
                count += 1
        return {"new_emails": count}
    except Exception as e:
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

 
@app.post("/mail/fetch/debug")
def fetch_emails_debug():
    try:
        service  = authenticate()
        messages = get_new_quotation_emails(service)
        return {"messages_found": len(messages), "status": "ok"}
    except Exception as e:
        return {"error": str(e), "traceback": traceback.format_exc()}
 
@app.get("/rfqs")
def get_rfqs():
    return get_all_rfqs()

@app.get("/rfqs/{rfq_id}")
def get_rfq(rfq_id: int):
    rfqs = get_all_rfqs()
    rfq  = next((r for r in rfqs if r['id'] == rfq_id), None)
    if not rfq:
        raise HTTPException(status_code=404, detail="RFQ not found")
    return rfq

@app.get("/quotes")
def get_quotes():
    return get_all_quotes()

@app.get("/quotes/{quote_id}")
def get_quote(quote_id: int):
    quotes = get_all_quotes()
    quote  = next((q for q in quotes if q['id'] == quote_id), None)
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")
    return quote


@app.post("/quotes/generate/{rfq_id}")
def generate_quote_route(rfq_id: int):
    rfqs = get_all_rfqs()
    rfq  = next((r for r in rfqs if r['id'] == rfq_id), None)
    if not rfq:
        raise HTTPException(status_code=404, detail="RFQ not found")
    items    = rfq.get('items', [])
    enriched = fetch_prices(items)
    found_names   = {i['name'] for i in enriched}
    missing_items = [i for i in items if i['name'] not in found_names]
    if missing_items:
        return {
            "status":        "missing_items",
            "missing_items": missing_items,
            "found_items":   enriched,
            "rfq_id":        rfq_id
        }
    quote = {
        'rfq_id':            rfq_id,
        'recipient':         rfq.get('sender'),
        'items':             enriched,
        'unavailable_items': [],
        'grand_total':       sum(i['total'] for i in enriched),
        'status':            'pending',
        'created_at':        str(date.today())
    }
    new_id = save_quote(quote)
    update_rfq_status(rfq_id, 'pending')
    return {"status": "ok", "id": new_id, **quote}


@app.post("/quotes/generate/{rfq_id}/with-prices")
def generate_with_prices(rfq_id: int, extra_prices: dict):
    try:
        conn   = mysql.connector.connect(**DB_CONFIG)
        cursor = conn.cursor()
        for part in extra_prices.get("prices", []):
            cursor.execute(
                "INSERT INTO manufacturing_parts (name, price, modified_date) VALUES (%s,%s,%s)",
                (part['name'], part['price'], date.today())
            )
        conn.commit()
        cursor.close(); conn.close()
        rfqs     = get_all_rfqs()
        rfq      = next((r for r in rfqs if r['id'] == rfq_id), None)
        items    = rfq.get('items', [])
        enriched = fetch_prices(items)
        found_names       = {i['name'] for i in enriched}
        unavailable_items = [i for i in items if i['name'] not in found_names]
        quote = {
            'rfq_id':            rfq_id,
            'recipient':         rfq.get('sender'),
            'items':             enriched,
            'unavailable_items': unavailable_items,
            'grand_total':       sum(i['total'] for i in enriched),
            'status':            'pending',
            'created_at':        str(date.today())
        }
        new_id = save_quote(quote)
        update_rfq_status(rfq_id, 'pending')
        return {"status": "ok", "id": new_id, **quote}
    except Exception as e:
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

        
@app.post("/quotes/{quote_id}/send")
def send_quote_route(quote_id: int):
    try:
        quotes = get_all_quotes()
        quote  = next((q for q in quotes if q['id'] == quote_id), None)
        if not quote:
            raise HTTPException(status_code=404, detail="Quote not found")
        enriched          = quote.get('items', [])
        unavailable_items = quote.get('unavailable_items', [])
        quotation_file    = generate_csv(enriched, unavailable_items=unavailable_items)
        send_email(quote['recipient'], quotation_file, unavailable_items=unavailable_items)
        update_quote_status(quote_id, 'sent')
        update_rfq_status(quote['rfq_id'], 'sent')
        return {"status": "sent"}
    except Exception as e:
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/parts")
def get_parts():
    try:
        conn   = mysql.connector.connect(**DB_CONFIG)
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM manufacturing_parts")
        rows    = cursor.fetchall()
        columns = [desc[0] for desc in cursor.description]
        parts   = [dict(zip(columns, row)) for row in rows]
        cursor.close()
        conn.close()
        return parts
    except Exception as e:
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))
 
@app.post("/parts")
def create_part(part: dict):
    try:
        conn   = mysql.connector.connect(**DB_CONFIG)
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO manufacturing_parts (name, price, modified_date) VALUES (%s, %s, %s)",
            (part['name'], part['price'], date.today())
        )
        conn.commit()
        new_id = cursor.lastrowid
        cursor.close()
        conn.close()
        return {"id": new_id, **part}
    except Exception as e:
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))
 
@app.put("/parts/{part_id}")
def update_part(part_id: int, part: dict):
    try:
        conn   = mysql.connector.connect(**DB_CONFIG)
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE manufacturing_parts SET name=%s, price=%s, modified_date=%s WHERE id=%s",
            (part['name'], part['price'], date.today(), part_id)
        )
        conn.commit()
        cursor.close()
        conn.close()
        return {"id": part_id, **part}
    except Exception as e:
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))
 
@app.delete("/parts/{part_id}")
def delete_part(part_id: int):
    try:
        conn   = mysql.connector.connect(**DB_CONFIG)
        cursor = conn.cursor()
        cursor.execute("DELETE FROM manufacturing_parts WHERE id=%s", (part_id,))
        conn.commit()
        cursor.close()
        conn.close()
        return {"deleted": True}
    except Exception as e:
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))
 
@app.get("/stats")
def get_stats():
    rfqs   = get_all_rfqs()
    quotes = get_all_quotes()
    return {
        "total_rfqs":  len(rfqs),
        "quotes_sent": len([q for q in quotes if q['status'] == 'sent']),
        "pending":     len([r for r in rfqs if r['status'] not in ('sent', 'pending')]),
        "grand_total": sum(q.get('grand_total', 0) for q in quotes)
    }
 
# ── Background email watcher ──────────────────────────────────
def background_watcher():
    print(f"🔁 Background watcher started — checking every {CHECK_INTERVAL}s")
    service = authenticate()
    while True:
        try:
            messages = get_new_quotation_emails(service)
            if messages:
                print(f"📬 Auto-fetch: {len(messages)} new email(s)")
                for msg in messages:
                    sender, csv_path = process_email(service, msg['id'])
                    if csv_path and sender:
                        items = read_csv(csv_path)
                        rfq   = {
                            'sender':      sender,
                            'sender_email':sender,
                            'subject':     'Quotation Request',
                            'items':       items,
                            'parts_count': len(items),
                            'status':      'new',
                            'date':        str(date.today())
                        }
                        save_rfq(rfq)
            else:
                print(f"⏳ Auto-fetch: no new emails")
        except Exception as e:
            print(f"❌ Watcher error: {e}")
            print(traceback.format_exc())
        time.sleep(CHECK_INTERVAL)
         
@app.on_event("startup")
def start_watcher():
    thread = threading.Thread(target=background_watcher, daemon=True)
    thread.start()
    print("✅ Background email watcher running")