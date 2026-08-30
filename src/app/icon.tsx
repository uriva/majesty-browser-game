import { ImageResponse } from 'next/og';

export const dynamic = 'force-static';

export const size = {
  width: 32,
  height: 32,
};
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 24,
          background: 'linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 7,
          border: '1.5px solid #f59e0b',
        }}
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M5 18L3 7L8.5 12L12 5L15.5 12L21 7L19 18H5Z"
            fill="url(#goldGradient)"
            stroke="#78350f"
            strokeWidth="0.8"
          />
          <circle cx="3" cy="7" r="1.5" fill="#fef08a" />
          <circle cx="12" cy="5" r="1.5" fill="#fef08a" />
          <circle cx="21" cy="7" r="1.5" fill="#fef08a" />
          <circle cx="8.5" cy="12" r="1" fill="#ef4444" />
          <circle cx="15.5" cy="12" r="1" fill="#3b82f6" />
          <rect x="5" y="17" width="14" height="2" rx="0.5" fill="#d97706" />
          <defs>
            <linearGradient id="goldGradient" x1="12" y1="5" x2="12" y2="18" gradientUnits="userSpaceOnUse">
              <stop stopColor="#fde047" />
              <stop offset="0.5" stopColor="#eab308" />
              <stop offset="1" stopColor="#b45309" />
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
