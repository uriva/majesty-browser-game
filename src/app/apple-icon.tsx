import { ImageResponse } from 'next/og';

export const dynamic = 'force-static';

export const size = {
  width: 180,
  height: 180,
};
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          background: 'radial-gradient(circle at center, #1e1b4b 0%, #020617 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 40,
          border: '4px solid #f59e0b',
        }}
      >
        <svg
          width="120"
          height="120"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M4.5 19L2 6.5L8 12.5L12 4L16 12.5L22 6.5L19.5 19H4.5Z"
            fill="url(#goldGradLg)"
            stroke="#78350f"
            strokeWidth="0.8"
          />
          <circle cx="2" cy="6.5" r="1.6" fill="#fef08a" stroke="#ca8a04" strokeWidth="0.4" />
          <circle cx="12" cy="4" r="1.8" fill="#fef08a" stroke="#ca8a04" strokeWidth="0.4" />
          <circle cx="22" cy="6.5" r="1.6" fill="#fef08a" stroke="#ca8a04" strokeWidth="0.4" />
          <circle cx="8" cy="12.5" r="1.2" fill="#ef4444" />
          <circle cx="16" cy="12.5" r="1.2" fill="#3b82f6" />
          <rect x="4.5" y="17.5" width="15" height="2.5" rx="0.8" fill="#b45309" stroke="#78350f" strokeWidth="0.4" />
          <circle cx="8.5" cy="18.75" r="0.6" fill="#ef4444" />
          <circle cx="12" cy="18.75" r="0.8" fill="#38bdf8" />
          <circle cx="15.5" cy="18.75" r="0.6" fill="#10b981" />
          <defs>
            <linearGradient id="goldGradLg" x1="12" y1="4" x2="12" y2="19" gradientUnits="userSpaceOnUse">
              <stop stopColor="#fef08a" />
              <stop offset="0.3" stopColor="#facc15" />
              <stop offset="0.7" stopColor="#d97706" />
              <stop offset="1" stopColor="#92400e" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    ),
    {
      ...size,
    }
  );
}
