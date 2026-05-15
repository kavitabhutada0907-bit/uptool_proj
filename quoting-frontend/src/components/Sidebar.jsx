import { NavLink } from 'react-router-dom';

const links = [
  { to: '/',        icon: '▣', label: 'Dashboard' },
  { to: '/rfqs',    icon: '✉', label: 'Inbox',    badge: null },
  { to: '/quotes',  icon: '◈', label: 'Quotes'   },
  { to: '/pricing', icon: '⊞', label: 'Parts DB'  },
  // { to: '/settings',icon: '⚙', label: 'Settings'  },
];

export default function Sidebar({ unreadCount }) {
  return (
    <aside className="sidebar">
      {/* <div className="sidebar-logo">
        <div className="dot" />
        Quote<span>Machine</span>
      </div> */}

      <div className="nav-section">
        <div className="nav-label">Menu</div>
        {links.map(l => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.to === '/'}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          >
            <span className="nav-icon">{l.icon}</span>
            {l.label}
            {l.to === '/rfqs' && unreadCount > 0 && (
              <span className="badge">{unreadCount}</span>
            )}
          </NavLink>
        ))}
      </div>

      <div style={{ marginTop: 'auto', padding: '0 24px' }}>
        <div className="live-dot">Watching inbox</div>
      </div>
    </aside>
  );
}
