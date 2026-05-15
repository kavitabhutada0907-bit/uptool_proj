CREATE TABLE manufacturing_parts (
  id            INT            NOT NULL PRIMARY KEY,
  name          VARCHAR(100)   NOT NULL,
  price         DECIMAL(10, 2) NOT NULL,
  modified_date DATETIME       NOT NULL
);

INSERT INTO manufacturing_parts (id, name, price, modified_date) VALUES
  (1, 'Boults',                     100.00, '2026-05-01 09:15:00'),
  (2, 'Hammer',                     200.00, '2026-05-02 10:30:00'),
  (3, 'Ring of Narnia',             300.00, '2026-05-03 14:05:00'),
  (4, 'V-Belt A-42',                400.00, '2026-05-04 18:45:00'),
  (5, 'Stainless Steel Shaft 12mm', 500.00, '2026-05-05 08:00:00');

SELECT id, name, price, modified_date
FROM manufacturing_parts
ORDER BY id;