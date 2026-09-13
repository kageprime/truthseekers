// ponytail: one brand icon set — stroke SVGs, no emoji. currentColor, 14px default.
function Svg({ size = 14, children, ...rest }: { size?: number; children: React.ReactNode } & React.SVGProps<SVGSVGElement>) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...rest}>
      {children}
    </svg>
  );
}

export const IconBook = ({ size }: { size?: number }) => (<Svg size={size}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /><line x1="8" y1="7" x2="16" y2="7" /></Svg>);
export const IconGraph = ({ size }: { size?: number }) => (<Svg size={size}><circle cx="6" cy="6" r="2" /><circle cx="18" cy="6" r="2" /><circle cx="12" cy="15" r="2" /><line x1="7.5" y1="7" x2="10.5" y2="13.5" /><line x1="16.5" y1="7" x2="13.5" y2="13.5" /></Svg>);
export const IconScale = ({ size }: { size?: number }) => (<Svg size={size}><line x1="12" y1="3" x2="12" y2="21" /><line x1="5" y1="7" x2="19" y2="7" /><path d="M5 7l-2.5 6a2.8 2.8 0 0 0 5 0L5 7z" /><path d="M19 7l-2.5 6a2.8 2.8 0 0 0 5 0L19 7z" /><line x1="8" y1="21" x2="16" y2="21" /></Svg>);
export const IconQuestion = ({ size }: { size?: number }) => (<Svg size={size}><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.4 2.3c-.8.3-.9 1-.9 1.7" /><line x1="12" y1="17" x2="12" y2="17.01" /></Svg>);
export const IconClock = ({ size }: { size?: number }) => (<Svg size={size}><circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15 14" /></Svg>);
export const IconMap = ({ size }: { size?: number }) => (<Svg size={size}><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" /><line x1="8" y1="2" x2="8" y2="18" /><line x1="16" y1="6" x2="16" y2="22" /></Svg>);
export const IconChat = ({ size }: { size?: number }) => (<Svg size={size}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></Svg>);
export const IconTag = ({ size }: { size?: number }) => (<Svg size={size}><path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" /></Svg>);
export const IconGear = ({ size }: { size?: number }) => (<Svg size={size}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.14.31.82.62 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></Svg>);
export const IconWrench = ({ size }: { size?: number }) => (<Svg size={size}><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" /></Svg>);
export const IconBack = ({ size }: { size?: number }) => (<Svg size={size}><polyline points="15 18 9 12 15 6" /></Svg>);
export const IconFwd = ({ size }: { size?: number }) => (<Svg size={size}><polyline points="9 18 15 12 9 6" /></Svg>);
export const IconReload = ({ size }: { size?: number }) => (<Svg size={size}><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" /></Svg>);
export const IconCopy = ({ size }: { size?: number }) => (<Svg size={size}><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></Svg>);
export const IconSearch = ({ size }: { size?: number }) => (<Svg size={size}><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.5" y2="16.5" /></Svg>);
export const IconPin = ({ size }: { size?: number }) => (<Svg size={size}><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></Svg>);
export const IconPencil = ({ size }: { size?: number }) => (<Svg size={size}><path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" /></Svg>);
export const IconFlask = ({ size }: { size?: number }) => (<Svg size={size}><path d="M9 3h6" /><path d="M10 3v6L4.5 19a2 2 0 0 0 1.8 3h11.4a2 2 0 0 0 1.8-3L14 9V3" /><line x1="7" y1="15" x2="17" y2="15" /></Svg>);
export const IconLock = ({ size }: { size?: number }) => (<Svg size={size}><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></Svg>);
export const IconClose = ({ size }: { size?: number }) => (<Svg size={size}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></Svg>);
export const IconSun = ({ size }: { size?: number }) => (<Svg size={size}><circle cx="12" cy="12" r="4" /><line x1="12" y1="2" x2="12" y2="5" /><line x1="12" y1="19" x2="12" y2="22" /><line x1="2" y1="12" x2="5" y2="12" /><line x1="19" y1="12" x2="22" y2="12" /><line x1="4.9" y1="4.9" x2="7" y2="7" /><line x1="17" y1="17" x2="19.1" y2="19.1" /><line x1="4.9" y1="19.1" x2="7" y2="17" /><line x1="17" y1="7" x2="19.1" y2="4.9" /></Svg>);
export const IconMoon = ({ size }: { size?: number }) => (<Svg size={size}><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></Svg>);
export const IconBone = ({ size }: { size?: number }) => (<Svg size={size}><path d="M17 10c.7-.7 1.7-1 2.5-.5a2.5 2.5 0 1 0-3-4c-.4.7-1.2 1-2 1H9a4 4 0 0 0-2.6 1L4 9.8a2.5 2.5 0 0 0 3.5 3.5l1.2-1.2" /><path d="M7 14c-.7.7-1.7 1-2.5.5a2.5 2.5 0 1 0 3 4c.4-.7 1.2-1 2-1h5.5a4 4 0 0 0 2.6-1l2.4-2.3a2.5 2.5 0 0 0-3.5-3.5l-1.2 1.2" /></Svg>);
export const IconMountain = ({ size }: { size?: number }) => (<Svg size={size}><path d="M3 20L10 6l4 7 3-4 4 11H3z" /><circle cx="17.5" cy="5.5" r="1.5" /></Svg>);
export const IconHome = ({ size }: { size?: number }) => (<Svg size={size}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></Svg>);
export const IconList = ({ size }: { size?: number }) => (<Svg size={size}><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></Svg>);
