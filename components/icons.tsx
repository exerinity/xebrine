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

export const MoonIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M20.5 14.4A8.5 8.5 0 1 1 9.6 3.5a7 7 0 0 0 10.9 10.9Z" />
  </Svg>
);

export const LastfmIcon = ({ size = 20 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 640 640" fill="currentColor" aria-hidden="true">
    <path d="M544 160C544 124.7 515.3 96 480 96L160 96C124.7 96 96 124.7 96 160L96 480C96 515.3 124.7 544 160 544L480 544C515.3 544 544 515.3 544 480L544 160zM306.7 344.8C304.9 339.3 303.3 334 301.7 328.9C288.8 287 280.7 260.5 243.7 260.5C221.3 260.5 198.6 276.6 198.6 321.7C198.6 356.9 216.6 378.9 241.9 378.9C270.5 378.9 289.5 357.6 289.5 357.6L301.2 389.5C301.2 389.5 281.4 408.9 240 408.9C188.7 408.9 160.1 378.8 160.1 323.1C160.1 265.2 188.7 231.1 242.6 231.1C310.5 231.1 321.9 266.4 339 319.5C340.4 323.9 341.9 328.4 343.4 333C352.2 359.8 367.6 379.2 404.6 379.2C429.5 379.2 442.7 373.7 442.7 360.1C442.7 342.6 425.8 338.9 402.7 333.7C399.5 333 396.2 332.3 392.8 331.5C362.4 324.2 350.3 308.4 350.3 283.5C350.3 243.5 382.6 231.1 415.5 231.1C452.9 231.1 475.6 244.7 478.5 277.7L441.8 282.1C440.3 266.3 430.8 259.7 413.2 259.7C397.1 259.7 387.2 267 387.2 279.5C387.2 290.5 392 297.1 408.1 300.8C410.3 301.3 412.6 301.8 414.8 302.2C445.9 308.7 479.9 315.9 479.9 358.3C480 395 449.2 408.9 403.8 408.9C340.4 408.9 318.4 380.3 306.7 344.8z" />
  </svg>
);

export const LastfmMarkIcon = ({ size = 20 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 640 640" fill="currentColor" aria-hidden="true">
    <path d="M289.8 431.1L271 380.1C271 380.1 240.5 414.1 194.8 414.1C154.3 414.1 125.6 378.9 125.6 322.6C125.6 250.5 162 224.7 197.7 224.7C264.2 224.7 272.5 278 298.6 359.6C317.4 416.5 352.6 462.2 454 462.2C526.7 462.2 576 439.9 576 381.3C576 308.4 513.3 300.7 461 289.2C435.2 283.3 427.6 272.8 427.6 255.2C427.6 235.3 443.4 223.5 469.2 223.5C497.4 223.5 512.6 234.1 514.9 259.3L573.5 252.3C568.8 199.5 532.4 177.8 472.6 177.8C419.8 177.8 368.2 197.7 368.2 261.7C368.2 301.6 387.6 326.8 436.2 338.5C481.1 349.1 516 352.3 516 384.2C516 405.9 494.9 414.7 455 414.7C395.8 414.7 371.1 383.6 357.1 340.8C325.1 244 313.5 177.8 195.8 177.8C109.7 177.8 64 232.3 64 325C64 414.1 109.7 462.2 191.9 462.2C258.1 462.2 289.8 431.1 289.8 431.1z" />
  </svg>
);

export const LastfmWordmark = ({ height = 22 }: { height?: number }) => (
  <svg
    width={Math.round(height * 3.9522)}
    height={height}
    viewBox="0 0 708.767 179.332"
    fill="#d51007"
    role="img"
    aria-label="Last.fm"
  >
    <path d="m158.431 165.498-8.354-22.708s-13.575 15.14-33.932 15.14c-18.013 0-30.802-15.662-30.802-40.721 0-32.106 16.182-43.591 32.107-43.591 22.969 0 30.277 14.878 36.543 33.934l8.354 26.103c8.351 25.318 24.013 45.678 69.17 45.678 32.37 0 54.295-9.918 54.295-36.02 0-21.143-12.009-32.107-34.458-37.328l-16.705-3.654c-11.484-2.61-14.877-7.309-14.877-15.14 0-8.875 7.046-14.096 18.533-14.096 12.529 0 19.315 4.699 20.36 15.923l26.102-3.133c-2.088-23.492-18.271-33.15-44.896-33.15-23.491 0-46.462 8.875-46.462 37.327 0 17.75 8.614 28.975 30.277 34.195l17.752 4.175c13.312 3.133 17.748 8.614 17.748 16.185 0 9.656-9.396 13.572-27.146 13.572-26.364 0-37.325-13.834-43.591-32.89l-8.614-26.101c-10.961-33.934-28.452-46.463-63.169-46.463-38.37 0-58.731 24.275-58.731 65.517 0 39.677 20.361 61.08 56.906 61.08 29.492 0 43.59-13.834 43.59-13.834zM46.726 153.229c-2.61.784-5.221 1.306-8.614 1.306-6.265 0-10.703-2.87-10.703-10.442V1.827H0v148.792c0 19.577 13.575 27.672 29.497 27.672 5.221 0 10.181-.785 16.446-2.349l.783-22.713zm330.185-4.176c-6.787 4.701-12.529 7.051-20.36 7.051-9.92 0-15.401-5.221-15.401-18.012V77.006h36.023V55.603H341.41V26.625l-27.669 3.394v25.583h-17.49v21.403h17.49v66.826c0 24.02 13.834 35.5 36.284 35.5 12.269 0 23.232-2.346 31.847-7.305l-4.961-22.973zm23.807 9.396c0 10.705 8.354 19.318 19.056 19.318 11.226 0 19.578-8.613 19.578-19.318 0-10.963-8.353-19.313-19.578-19.313-10.702 0-19.056 8.35-19.056 19.313zm67.009-81.443v99.195h27.409V77.006h30.803V55.603h-30.803V44.638c0-16.444 7.049-21.665 18.534-21.665 8.092 0 13.574 1.825 19.839 5.221l4.437-22.974C530.638 1.827 522.023 0 511.582 0c-22.973 0-43.855 10.963-43.855 43.593v12.01h-17.489v21.403h17.489zm167.427 2.352c-3.133-19.578-15.923-26.629-32.63-26.629-16.706 0-31.062 7.571-37.329 26.104l-3.393-23.23h-22.188v120.598h27.409v-68.129c0-23.235 12.008-32.11 24.799-32.11 13.312 0 18.795 8.875 18.795 23.232V176.2h27.147v-68.39c0-22.974 12.269-31.849 25.061-31.849 13.052 0 18.532 8.875 18.532 23.232v77.006h27.409v-86.66c0-25.843-15.14-36.81-35.24-36.81-16.965 0-32.107 7.571-38.372 26.629z" />
  </svg>
);

export const ListIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="4" y="5.5" width="3" height="3" rx="1" />
    <rect x="4" y="10.5" width="3" height="3" rx="1" />
    <rect x="4" y="15.5" width="3" height="3" rx="1" />
    <rect x="10" y="6" width="10" height="2" rx="1" />
    <rect x="10" y="11" width="10" height="2" rx="1" />
    <rect x="10" y="16" width="10" height="2" rx="1" />
  </Svg>
);

export const GridIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="4" y="4" width="7" height="7" rx="1.5" />
    <rect x="13" y="4" width="7" height="7" rx="1.5" />
    <rect x="4" y="13" width="7" height="7" rx="1.5" />
    <rect x="13" y="13" width="7" height="7" rx="1.5" />
  </Svg>
);

export const LogoIcon = ({ size = 20 }: IconProps) => (
  <svg width={size} height={size} viewBox="70 260 563 545" fill="currentColor" aria-hidden="true">
    <path d="M86 413c26 -8 54 -12 84 -12s58 4 85 12v318h-169v-131h150v-56c-20 -4 -42 -6 -66 -6c-29 0 -57 4 -84 12v-137zM617 552c-27 -8 -56 -12 -85 -12c-30 0 -58 4 -84 12v-137c26 -8 54 -12 84 -12c29 0 58 4 85 12v137zM447 415c-27 -8 -55 -12 -84 -12c-23 0 -44 2 -66 6v384h-19v-515c27 -8 56 -12 85 -12c30 0 58 4 84 12v137z" />
  </svg>
);
