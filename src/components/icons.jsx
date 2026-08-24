function Icon({ size = 20, children, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      {children}
    </svg>
  )
}

export function IconHome(props) {
  return (
    <Icon {...props}>
      <path d="M4 10.5 12 4l8 6.5V20a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 20v-9.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M9.5 21.5v-7h5v7" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </Icon>
  )
}

export function IconOrders(props) {
  return (
    <Icon {...props}>
      <path d="M8 5.5h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <rect x="6" y="3.5" width="12" height="3.5" rx="1.2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M7 7h10v13.5a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 7 20.5V7Z" stroke="currentColor" strokeWidth="1.8" />
      <path d="M9.5 12h5M9.5 16h3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </Icon>
  )
}

export function IconStock(props) {
  return (
    <Icon {...props}>
      <path d="M3.8 8.2 12 4l8.2 4.2L12 12.4 3.8 8.2Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M12 12.4V21M3.8 8.2V16L12 21l8.2-5V8.2" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </Icon>
  )
}

export function IconProducts(props) {
  return (
    <Icon {...props}>
      <path d="M3.8 12.2 12 4h7.5A1.5 1.5 0 0 1 21 5.5V13l-8.2 8.2a1.5 1.5 0 0 1-2.1 0L3.8 14.3a1.5 1.5 0 0 1 0-2.1Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <circle cx="16.2" cy="8.2" r="1.2" fill="currentColor" />
    </Icon>
  )
}

export function IconReposicion(props) {
  return (
    <Icon {...props}>
      <path d="M6 8.5h12l-.8 11.2A1.8 1.8 0 0 1 15.4 21H8.6a1.8 1.8 0 0 1-1.8-1.3L6 8.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M9 8.5V7a3 3 0 0 1 6 0v1.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </Icon>
  )
}

export function IconMoney(props) {
  return (
    <Icon {...props}>
      <rect x="3" y="6" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="2.4" stroke="currentColor" strokeWidth="1.8" />
    </Icon>
  )
}

export function IconTrash(props) {
  return (
    <Icon {...props}>
      <path d="M4 8h16M6 8v11.5A1.5 1.5 0 0 0 7.5 21h9a1.5 1.5 0 0 0 1.5-1.5V8M10 8V5.5A1.5 1.5 0 0 1 11.5 4h1A1.5 1.5 0 0 1 14 5.5V8" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </Icon>
  )
}

export function IconInvoice(props) {
  return (
    <Icon {...props}>
      <path d="M7 3.5h10v17l-2-1.2-2 1.2-2-1.2-2 1.2-2-1.2V3.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M9.5 8h5M9.5 12h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </Icon>
  )
}

export function IconSettings(props) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 3.5v2.2M12 18.3v2.2M4.8 6.4l1.6 1.6M17.6 16l1.6 1.6M3.5 12h2.2M18.3 12h2.2M4.8 17.6l1.6-1.6M17.6 8l1.6-1.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </Icon>
  )
}

export function IconMenu(props) {
  return (
    <Icon {...props}>
      <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </Icon>
  )
}

export function IconClose(props) {
  return (
    <Icon {...props}>
      <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </Icon>
  )
}
