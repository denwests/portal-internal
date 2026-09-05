const paths = {
  dashboard: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
  booking: <><path d="M6 3v3M18 3v3M4 9h16" /><rect x="4" y="5" width="16" height="16" rx="3" /><path d="M8 13h3v3H8zM14 13h2M14 17h2" /></>,
  gallery: <><rect x="3" y="4" width="18" height="16" rx="3" /><circle cx="9" cy="10" r="2" /><path d="m5.5 18 4.2-4.2 3.1 2.7 2.6-2.6 3.2 4.1" /></>,
  social: <><path d="M20 11.5a7.7 7.7 0 0 1-8 7.4 9.4 9.4 0 0 1-4.1-.9L4 20l1.2-3.7A7 7 0 0 1 4 12.4 7.7 7.7 0 0 1 12 5a7.7 7.7 0 0 1 8 6.5Z" /><path d="M8 11.5h.01M12 11.5h.01M16 11.5h.01" /></>,
  transactions: <><path d="M4 7h16M7 4v6M17 4v6" /><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M8 14h8M8 17h5" /></>,
  customer: <><circle cx="12" cy="8" r="4" /><path d="M4.5 20c.8-4 3.2-6 7.5-6s6.7 2 7.5 6" /></>,
  spending: <><path d="M4 8h16v11H4z" /><path d="M4 10.5h16M8 15h3" /><path d="M7 8V5h10v3" /></>,
  bookkeeping: <><path d="M6 3h9l4 4v14H6z" /><path d="M15 3v5h4M9 12h6M9 16h6" /></>,
  timeline: <><path d="M5 5v14M5 8h6l2-2h6v6h-6l-2-2H5M9 15h9M9 19h6" /></>,
  invoice: <><path d="M6 3h9l4 4v14H6z" /><path d="M15 3v5h4M9 12h6M9 16h6" /><path d="M9 8h2" /></>,
  employee: <><circle cx="9" cy="8" r="3" /><path d="M3.5 18c.6-3.2 2.4-4.8 5.5-4.8s4.9 1.6 5.5 4.8M17 8v6M14 11h6" /></>,
  documents: <><path d="M6 3h9l4 4v14H6z" /><path d="M15 3v5h4M9 12h6M9 16h6" /></>,
};

function PortalIcon({ name }) {
  return (
    <svg className="portal-icon" viewBox="0 0 24 24" aria-hidden="true">
      {paths[name] || paths.dashboard}
    </svg>
  );
}

export default PortalIcon;
