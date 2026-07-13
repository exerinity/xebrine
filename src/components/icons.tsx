interface IconProps {
  size?: number;
}

function Svg({ size = 20, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const PlayIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M8 5.14v13.72c0 .78.85 1.26 1.52.85l10.9-6.86a1 1 0 0 0 0-1.7L9.52 4.29A1 1 0 0 0 8 5.14Z" />
  </Svg>
);

export const PauseIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="6" y="4.5" width="4" height="15" rx="1" />
    <rect x="14" y="4.5" width="4" height="15" rx="1" />
  </Svg>
);

export const PrevIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="5" y="5" width="2.4" height="14" rx="1" />
    <path d="M19 6.2v11.6c0 .8-.9 1.27-1.55.8L9.6 12.8a1 1 0 0 1 0-1.6l7.85-5.8c.65-.47 1.55 0 1.55.8Z" />
  </Svg>
);

export const NextIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="16.6" y="5" width="2.4" height="14" rx="1" />
    <path d="M5 6.2v11.6c0 .8.9 1.27 1.55.8l7.85-5.8a1 1 0 0 0 0-1.6L6.55 5.4C5.9 4.93 5 5.4 5 6.2Z" />
  </Svg>
);

export const ShuffleIcon = (p: IconProps) => (
  <Svg {...p}>
    <path
      d="M3 7h3.5c1.2 0 2.3.55 3.03 1.5L14 15.5A3.83 3.83 0 0 0 17.03 17H20M3 17h3.5c1.2 0 2.3-.55 3.03-1.5l.72-.93m3.03-3.89.72-.93A3.83 3.83 0 0 1 17.03 7H20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
    <path d="M18 4.5 21.5 7 18 9.5v-5ZM18 14.5 21.5 17 18 19.5v-5Z" />
  </Svg>
);

export const RepeatIcon = (p: IconProps) => (
  <Svg {...p}>
    <path
      d="M4 15v-4a4 4 0 0 1 4-4h9M20 9v4a4 4 0 0 1-4 4H7"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path d="M15.6 3.9 19.2 7l-3.6 3.1v-6.2ZM8.4 13.9 4.8 17l3.6 3.1v-6.2Z" />
  </Svg>
);

export const RepeatOneIcon = (p: IconProps) => (
  <Svg {...p}>
    <path
      d="M4 15v-4a4 4 0 0 1 4-4h9M20 9v4a4 4 0 0 1-4 4H7"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path d="M15.6 3.9 19.2 7l-3.6 3.1v-6.2ZM8.4 13.9 4.8 17l3.6 3.1v-6.2Z" />
    <path
      d="M11 10.6 12.6 9.4v5.2"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export const PlusIcon = (p: IconProps) => (
  <Svg {...p}>
    <path
      d="M12 5v14M5 12h14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </Svg>
);

export const SearchIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" strokeWidth="2" />
    <path d="m15.5 15.5 4.5 4.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </Svg>
);

export const CloseIcon = (p: IconProps) => (
  <Svg {...p}>
    <path
      d="M6 6l12 12M18 6L6 18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </Svg>
);

export const DragIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="9" cy="6.5" r="1.4" />
    <circle cx="15" cy="6.5" r="1.4" />
    <circle cx="9" cy="12" r="1.4" />
    <circle cx="15" cy="12" r="1.4" />
    <circle cx="9" cy="17.5" r="1.4" />
    <circle cx="15" cy="17.5" r="1.4" />
  </Svg>
);

export const BackIcon = (p: IconProps) => (
  <Svg {...p}>
    <path
      d="M10.5 5.5 4 12l6.5 6.5M4.5 12H20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export const ChevronRightIcon = (p: IconProps) => (
  <Svg {...p}>
    <path
      d="M9 5l7 7-7 7"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export const NoteIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9 3v10.55A4 4 0 1 0 11 17V7h8V3H9Z" />
  </Svg>
);

export const VolumeIcon = ({ size = 20, level = 2 }: IconProps & { level?: 0 | 1 | 2 | 3 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
  >
    <path
      d="M4 9.3v5.4h4.1l5 4.1V5.2l-5 4.1H4Z"
      fill="currentColor"
    />
    {level === 0 ? (
      <path
        d="m16.2 9.6 4 4M20.2 9.6l-4 4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    ) : (
      <>
        {level >= 1 && (
          <path
            d="M15.8 9.4c.7.7 1 1.6 1 2.6s-.3 1.9-1 2.6"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        )}
        {level >= 2 && (
          <path
            d="M18 7.2a6.9 6.9 0 0 1 0 9.6"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        )}
        {level >= 3 && (
          <path
            d="M20.2 5a10 10 0 0 1 0 14"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        )}
      </>
    )}
  </svg>
);

export const CheckIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
    <path
      d="m7.5 12.3 3 3 6-6.2"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export const ErrorIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
    <path
      d="m9 9 6 6M15 9l-6 6"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
  </Svg>
);

export const WarningIcon = (p: IconProps) => (
  <Svg {...p}>
    <path
      d="M12 3.6 21.3 19.8H2.7Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
    />
    <path d="M12 9.6v4.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <circle cx="12" cy="16.8" r="1" />
  </Svg>
);

export const InfoIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
    <path d="M12 11v5.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <circle cx="12" cy="7.8" r="1.05" />
  </Svg>
);

export const HomeIcon = (p: IconProps) => (
  <Svg {...p}>
    <path
      d="M4 11.5 12 4l8 7.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M6 10.5V20h5v-5.5h2V20h5v-9.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
    />
  </Svg>
);

export const PersonIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="8" r="3.6" />
    <path
      d="M4.5 20c1-4 4-6 7.5-6s6.5 2 7.5 6"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </Svg>
);

export const DiscIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
    <circle cx="12" cy="12" r="2.6" />
  </Svg>
);

export const QueueIcon = (p: IconProps) => (
  <Svg {...p}>
    <path
      d="M4 6h11M4 12h11M4 18h7"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      fill="none"
    />
    <circle cx="19" cy="8" r="1.6" />
    <path
      d="M19 8V16.5a2.3 2.3 0 1 1-1.4-2.1"
      stroke="currentColor"
      strokeWidth="1.8"
      fill="none"
      strokeLinecap="round"
    />
  </Svg>
);

export const LyricsIcon = (p: IconProps) => (
  <Svg {...p}>
    <g transform="rotate(45 12 12)">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M10.5 0.5 H13.5 A3.5 3.5 0 0 1 17 4 V8 A3.5 3.5 0 0 1 13.5 11.5 H10.5 A3.5 3.5 0 0 1 7 8 V4 A3.5 3.5 0 0 1 10.5 0.5 Z M8.5 2.2 H15.5 V3.4 H8.5 Z M8.5 4.6 H15.5 V5.8 H8.5 Z M8.5 7 H15.5 V8.2 H8.5 Z"
      />
      <rect x="10.6" y="11" width="2.8" height="10.5" rx="1.4" />
    </g>
  </Svg>
);

export const SettingsIcon = (p: IconProps) => (
  <Svg {...p}>
    <path
      d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export const FolderIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3.5 6.5a1.5 1.5 0 0 1 1.5-1.5h4.4l2 2H19a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5H5a1.5 1.5 0 0 1-1.5-1.5v-10Z" />
  </Svg>
);

export const TrashIcon = (p: IconProps) => (
  <Svg {...p}>
    <path
      d="M5 7h14M9.5 7V5.2A1.2 1.2 0 0 1 10.7 4h2.6a1.2 1.2 0 0 1 1.2 1.2V7"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M6.5 7 7.3 19a1.5 1.5 0 0 0 1.5 1.4h6.4a1.5 1.5 0 0 0 1.5-1.4L17.5 7"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path d="M10 10.5v6M14 10.5v6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </Svg>
);

export const RefreshIcon = (p: IconProps) => (
  <Svg {...p}>
    <path
      d="M5 11a7 7 0 0 1 12-4.5M19 6v4h-4M19 13a7 7 0 0 1-12 4.5M5 18v-4h4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export const UploadIcon = (p: IconProps) => (
  <Svg {...p}>
    <path
      d="M12 15V5M8 9l4-4 4 4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M5 16v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export const DownloadIcon = (p: IconProps) => (
  <Svg {...p}>
    <path
      d="M12 5v10M8 11l4 4 4-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M5 16v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export const ShareIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="6" cy="12" r="2.6" />
    <circle cx="17.5" cy="5.5" r="2.6" />
    <circle cx="17.5" cy="18.5" r="2.6" />
    <path
      d="m8.4 10.8 6.6-4M8.4 13.2l6.6 4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
  </Svg>
);

export const KeyIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="8" cy="14" r="3.4" fill="none" stroke="currentColor" strokeWidth="1.8" />
    <path
      d="M10.3 11.7 18 4M15.5 6.5 18 9M18 4l2 2"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export const PlayNextIcon = (p: IconProps) => (
  <Svg {...p}>
    <path
      d="M3 6h9M3 12h9M3 18h5"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      fill="none"
    />
    <path d="M15 8.5v7l6-3.5-6-3.5Z" />
  </Svg>
);

export const VisualizerIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3.5" y="10" width="3" height="8" rx="1" />
    <rect x="9" y="4.5" width="3" height="14.5" rx="1" />
    <rect x="14.5" y="7.5" width="3" height="11.5" rx="1" />
    <rect x="20" y="12" width="3" height="6.5" rx="1" />
  </Svg>
);

export const AutoMixIcon = (p: IconProps) => (
  <Svg {...p}>
    <path
      d="M3 12h3.5l2.5-6 4 12 2.5-6H19"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path d="M18.2 9.2 21.5 12l-3.3 2.8v-5.6Z" />
  </Svg>
);

export const LogoIcon = ({ size = 20 }: IconProps) => (
  <svg width={size} height={size} viewBox="70 260 563 545" fill="currentColor" aria-hidden="true">
    <path d="M86 413c26 -8 54 -12 84 -12s58 4 85 12v318h-169v-131h150v-56c-20 -4 -42 -6 -66 -6c-29 0 -57 4 -84 12v-137zM617 552c-27 -8 -56 -12 -85 -12c-30 0 -58 4 -84 12v-137c26 -8 54 -12 84 -12c29 0 58 4 85 12v137zM447 415c-27 -8 -55 -12 -84 -12c-23 0 -44 2 -66 6v384h-19v-515c27 -8 56 -12 85 -12c30 0 58 4 84 12v137z" />
  </svg>
);
