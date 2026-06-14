"use client";

/**
 * SabAppLogo — full macOS-style app icons for the dock + Launchpad.
 *
 * Each logo is one self-contained SVG: a 48×48 squircle filled with the
 * app's gradient (from `app-colors.ts`), a soft top sheen + hairline
 * highlight for depth, and a custom FILLED white glyph designed to read
 * at dock size — the way macOS system icons do (Mail = envelope on blue,
 * Messages = bubble on green…).
 *
 * Design system for the glyphs:
 *   - 48×48 canvas, artwork roughly inside (10,10)–(38,38).
 *   - Filled white shapes; secondary detail uses white at lower opacity
 *     or black at ~20% (reads as a cutout on any gradient).
 *   - Real holes (camera lens, vault keyhole…) use `fillRule="evenodd"`.
 *
 * Apps without a bespoke glyph fall back to their registry stroke icon
 * rendered white on the gradient — new apps stay presentable by default.
 */

import * as React from "react";
import type { SVGProps } from "react";

import { appAccent } from "./app-colors";
import { SAB_APPS } from "./apps";

/* ── Shared stroke helpers (white line work inside filled glyphs) ────────── */

function S(props: SVGProps<SVGPathElement>) {
  return (
    <path
      fill="none"
      stroke="#fff"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    />
  );
}

/* ── Glyphs (white artwork per app id) ───────────────────────────────────── */

const GLYPHS: Record<string, React.ReactNode> = {
  /* Launchpad — 3×3 app grid. */
  launchpad: (
    <g fill="#fff">
      {[13, 21.2, 29.4].map((y) =>
        [13, 21.2, 29.4].map((x) => (
          <rect key={`${x}-${y}`} x={x} y={y} width={5.6} height={5.6} rx={1.8} />
        )),
      )}
    </g>
  ),

  /* Home — house with door. */
  home: (
    <path
      fill="#fff"
      fillRule="evenodd"
      d="M24 10.5 38.5 23.6a1 1 0 0 1-.67 1.74H35V36a2 2 0 0 1-2 2H15a2 2 0 0 1-2-2V25.34h-2.83a1 1 0 0 1-.67-1.74L24 10.5Zm-3 27.5v-8.6a1.4 1.4 0 0 1 1.4-1.4h3.2a1.4 1.4 0 0 1 1.4 1.4V38h-6Z"
    />
  ),

  /* WaChat — chat bubble with typing dots. */
  wachat: (
    <>
      <path
        fill="#fff"
        d="M17.5 12.5h13a6.5 6.5 0 0 1 6.5 6.5v5.5a6.5 6.5 0 0 1-6.5 6.5h-8.2L14 37.5a.9.9 0 0 1-1.45-.72V30A6.5 6.5 0 0 1 11 19a6.5 6.5 0 0 1 6.5-6.5Z"
      />
      <g fill="#000" opacity={0.22}>
        <circle cx={18.5} cy={22} r={1.8} />
        <circle cx={24} cy={22} r={1.8} />
        <circle cx={29.5} cy={22} r={1.8} />
      </g>
    </>
  ),

  /* Meta Suite — infinity loop with hollow ends. */
  facebook: (
    <path
      fill="#fff"
      fillRule="evenodd"
      d="M15.5 16.5c4.1 0 6.6 3.1 8.5 6.2 1.9-3.1 4.4-6.2 8.5-6.2 4.8 0 8 3.7 8 7.5s-3.2 7.5-8 7.5c-4.1 0-6.6-3.1-8.5-6.2-1.9 3.1-4.4 6.2-8.5 6.2-4.8 0-8-3.7-8-7.5s3.2-7.5 8-7.5Zm0 4.2c-2.5 0-3.9 1.9-3.9 3.3s1.4 3.3 3.9 3.3c2 0 3.6-1.7 5-3.3-1.4-1.6-3-3.3-5-3.3Zm17 0c-2 0-3.6 1.7-5 3.3 1.4 1.6 3 3.3 5 3.3 2.5 0 3.9-1.9 3.9-3.3s-1.4-3.3-3.9-3.3Z"
    />
  ),

  /* Ad Manager — megaphone with sound waves. */
  "ad-manager": (
    <>
      <path
        fill="#fff"
        d="M30.5 11.6c0-1 1.1-1.6 2-1L33 11v25l-.5.4c-.9.6-2 0-2-1l-8.3-5.4H14a3.5 3.5 0 0 1-3.5-3.5v-6A3.5 3.5 0 0 1 14 17h8.2l8.3-5.4Z"
      />
      <path fill="#fff" opacity={0.85} d="M15 31.5h4.6l1.6 6a1.2 1.2 0 0 1-1.16 1.5h-2.4a1.2 1.2 0 0 1-1.17-.92L15 31.5Z" />
      <S d="M36.5 19a7.5 7.5 0 0 1 0 9.6" />
    </>
  ),

  /* SabFlow — connected workflow nodes. */
  sabflow: (
    <>
      <S d="M17.5 16.5c6 1 9 4.5 12.5 6.2" strokeWidth={2.6} />
      <S d="M17.5 31.5c6-1 9-4.5 12.5-6.2" strokeWidth={2.6} />
      <g fill="#fff">
        <circle cx={14.5} cy={15} r={4.4} />
        <circle cx={14.5} cy={33} r={4.4} />
        <circle cx={34} cy={24} r={5.2} />
      </g>
    </>
  ),

  /* SabChat — two overlapping bubbles. */
  sabchat: (
    <>
      <rect x={9.5} y={11.5} width={21} height={14.5} rx={5.5} fill="#fff" opacity={0.6} />
      <path
        fill="#fff"
        d="M22.5 19.5h10.5a5.5 5.5 0 0 1 5.5 5.5v4a5.5 5.5 0 0 1-5.5 5.5h-5l-5.6 4.2a.9.9 0 0 1-1.43-.73V34.7a5.5 5.5 0 0 1-4-5.2v-4.5a5.5 5.5 0 0 1 5.53-5.5Z"
      />
    </>
  ),

  /* Telegram — paper plane. */
  telegram: (
    <>
      <path fill="#fff" d="M39.2 11.3 10.6 22.4a1.1 1.1 0 0 0 .08 2.08l7.62 2.3 2.3 8.5a1.1 1.1 0 0 0 1.83.52l4.27-4.13 6.9 5.06a1.1 1.1 0 0 0 1.73-.65l5.4-23.4a1.1 1.1 0 0 0-1.5-1.35Z" />
      <path fill="#000" opacity={0.18} d="m18.3 26.8 16.2-10.2-13.3 12.4-.6 5.4-2.3-7.6Z" />
    </>
  ),

  /* Instagram — camera with lens + flash dot. */
  instagram: (
    <g fill="#fff" fillRule="evenodd">
      <path d="M19 11.5h10A7.5 7.5 0 0 1 36.5 19v10a7.5 7.5 0 0 1-7.5 7.5H19A7.5 7.5 0 0 1 11.5 29V19a7.5 7.5 0 0 1 7.5-7.5Zm0 3.6A3.9 3.9 0 0 0 15.1 19v10a3.9 3.9 0 0 0 3.9 3.9h10a3.9 3.9 0 0 0 3.9-3.9V19a3.9 3.9 0 0 0-3.9-3.9H19Z" />
      <path d="M24 17.7a6.3 6.3 0 1 1 0 12.6 6.3 6.3 0 0 1 0-12.6Zm0 3.3a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z" />
      <circle cx={31.2} cy={16.9} r={1.8} />
    </g>
  ),

  /* Team — two people. */
  team: (
    <g fill="#fff">
      <circle cx={19} cy={17} r={4.6} />
      <path d="M10.5 35.5c0-5.2 3.8-8.5 8.5-8.5s8.5 3.3 8.5 8.5v.9a1.1 1.1 0 0 1-1.1 1.1H11.6a1.1 1.1 0 0 1-1.1-1.1v-.9Z" />
      <g opacity={0.62}>
        <circle cx={31.5} cy={16.5} r={3.6} />
        <path d="M26.8 26.3c1.4-.6 3-.9 4.7-.9 4.2 0 7.5 2.9 7.5 7.5v1.4a1.1 1.1 0 0 1-1.1 1.1h-8.4c.3-.9.5-1.9.5-2.9v-1c0-2-.4-3.8-1.2-5.2Z" />
      </g>
    </g>
  ),

  /* Email — envelope with flap. */
  email: (
    <>
      <rect x={9.5} y={13.5} width={29} height={21} rx={3.5} fill="#fff" />
      <path fill="#000" opacity={0.18} d="M11 15h26L24 26.4 11 15Z" />
    </>
  ),

  /* SabPay — credit card. */
  sabpay: (
    <>
      <rect x={9.5} y={14.5} width={29} height={19} rx={3.5} fill="#fff" />
      <rect x={9.5} y={19} width={29} height={4.4} fill="#000" opacity={0.26} />
      <rect x={13.5} y={27} width={7.5} height={3} rx={1.2} fill="#000" opacity={0.18} />
      <rect x={29} y={27} width={5} height={3} rx={1.2} fill="#000" opacity={0.18} />
    </>
  ),

  /* SabSMS — phone with message bubble. */
  sabsms: (
    <>
      <path
        fill="#fff"
        fillRule="evenodd"
        d="M19 9.5h10a4 4 0 0 1 4 4v21a4 4 0 0 1-4 4H19a4 4 0 0 1-4-4v-21a4 4 0 0 1 4-4Zm.5 4a1.5 1.5 0 0 0-1.5 1.5v17a1.5 1.5 0 0 0 1.5 1.5h9a1.5 1.5 0 0 0 1.5-1.5V15a1.5 1.5 0 0 0-1.5-1.5h-9Z"
      />
      <path fill="#fff" d="M20.5 17h7a2 2 0 0 1 2 2v2.6a2 2 0 0 1-2 2h-3.1l-3 2.3a.6.6 0 0 1-.96-.48V23.5a2 2 0 0 1-1.94-2V19a2 2 0 0 1 2-2Z" />
    </>
  ),

  /* API & Dev — code brackets + slash. */
  api: (
    <>
      <S d="m18 15.5-8.5 8.5 8.5 8.5" strokeWidth={3} />
      <S d="m30 15.5 8.5 8.5-8.5 8.5" strokeWidth={3} />
      <S d="m26.2 13-4.4 22" strokeWidth={2.6} />
    </>
  ),

  /* URL Shortener — chain link. */
  url: (
    <>
      <S d="m20.5 27.5 7-7" strokeWidth={3} />
      <S d="m21.5 17.5 3.2-3.2a5.8 5.8 0 0 1 8.2 8.2l-3.2 3.2" strokeWidth={3} />
      <S d="m26.5 30.5-3.2 3.2a5.8 5.8 0 0 1-8.2-8.2l3.2-3.2" strokeWidth={3} />
    </>
  ),

  /* QR Code — finder squares + modules. */
  qr: (
    <g fill="#fff">
      <path fillRule="evenodd" d="M11 11h11v11H11V11Zm3.2 3.2v4.6h4.6v-4.6h-4.6Z" />
      <path fillRule="evenodd" d="M26 11h11v11H26V11Zm3.2 3.2v4.6h4.6v-4.6h-4.6Z" />
      <path fillRule="evenodd" d="M11 26h11v11H11V26Zm3.2 3.2v4.6h4.6v-4.6h-4.6Z" />
      <rect x={26} y={26} width={4.4} height={4.4} rx={1} />
      <rect x={32.6} y={26} width={4.4} height={4.4} rx={1} />
      <rect x={26} y={32.6} width={4.4} height={4.4} rx={1} />
      <rect x={32.6} y={32.6} width={4.4} height={4.4} rx={1} />
    </g>
  ),

  /* SabFiles — folder. */
  sabfiles: (
    <>
      <path
        fill="#fff"
        d="M10 16.5a3 3 0 0 1 3-3h7.2a2 2 0 0 1 1.42.59L24.5 17H35a3 3 0 0 1 3 3v14a3 3 0 0 1-3 3H13a3 3 0 0 1-3-3v-17.5Z"
      />
      <path fill="#000" opacity={0.14} d="M10 21h28v2.6H10z" />
    </>
  ),

  /* SabBigin — pipeline funnel. */
  sabbigin: (
    <path
      fill="#fff"
      d="M12.2 12.5h23.6a1.6 1.6 0 0 1 1.23 2.63L28 25.6V34a1.6 1.6 0 0 1-.86 1.42l-5 2.6A1.6 1.6 0 0 1 19.8 36.6V25.6l-8.83-10.47a1.6 1.6 0 0 1 1.23-2.63Z"
    />
  ),

  /* SabShop — shopping bag. */
  sabshop: (
    <>
      <path fill="#fff" d="M13.5 18.5h21a2 2 0 0 1 2 1.84l1.2 15A3 3 0 0 1 34.7 38.5H13.3a3 3 0 0 1-3-3.16l1.2-15a2 2 0 0 1 2-1.84Z" />
      <S d="M18.8 22v-6.2a5.2 5.2 0 0 1 10.4 0V22" strokeWidth={2.6} />
    </>
  ),

  /* SabCheckout — cart. */
  sabcheckout: (
    <>
      <S d="M11.5 14.5h4l3.6 15h13.4l3.2-11H17" strokeWidth={2.8} />
      <g fill="#fff">
        <circle cx={21} cy={35} r={2.4} />
        <circle cx={31} cy={35} r={2.4} />
      </g>
    </>
  ),

  /* SabDesk — support headset. */
  sabdesk: (
    <>
      <S d="M13.5 27v-4a10.5 10.5 0 0 1 21 0v4" strokeWidth={3} />
      <g fill="#fff">
        <rect x={10.5} y={25.5} width={6} height={9} rx={2.5} />
        <rect x={31.5} y={25.5} width={6} height={9} rx={2.5} />
      </g>
      <S d="M34.5 34.5a7.5 7.5 0 0 1-6.5 3.8h-2" strokeWidth={2.5} />
    </>
  ),

  /* SabMail — @ sign. */
  sabmail: (
    <>
      <S d="M30.2 24a6.2 6.2 0 1 0-1.8 4.4" strokeWidth={3} />
      <S d="M30.2 17.8V26a3.6 3.6 0 0 0 7.2 0v-2a13.4 13.4 0 1 0-5.2 10.6" strokeWidth={3} />
    </>
  ),

  /* SabMeet — video call. */
  sabmeet: (
    <g fill="#fff">
      <rect x={9.5} y={15.5} width={20.5} height={17} rx={4} />
      <path d="m32.5 21.6 5.3-3.4a1.1 1.1 0 0 1 1.7.92v9.76a1.1 1.1 0 0 1-1.7.92l-5.3-3.4v-4.8Z" />
    </g>
  ),

  /* SabCall — phone handset. */
  sabcall: (
    <path
      fill="#fff"
      d="M14.8 10.9c1.9-.8 4 .1 4.9 2l1.9 3.8c.8 1.6.4 3.5-1 4.6l-1.8 1.5c1.6 3.9 4.7 7 8.6 8.6l1.5-1.8c1.1-1.4 3-1.8 4.6-1l3.8 1.9c1.9.9 2.8 3 2 4.9l-1 2.3c-.9 2.1-3.1 3.4-5.4 3-12.1-2.5-21.6-12-24.1-24.1-.4-2.3.9-4.5 3-5.4l3-1.3Z"
    />
  ),

  /* SabSign — pen + signature line. */
  sabsign: (
    <>
      <path fill="#fff" d="m28.6 10.6 8.8 8.8a1.2 1.2 0 0 1 0 1.7L21.6 36.9l-9.9 1.4a1 1 0 0 1-1.13-1.13L12 27.3 26.9 10.6a1.2 1.2 0 0 1 1.7 0Z" />
      <path fill="#000" opacity={0.18} d="m27.7 11.5 8.8 8.8-3 3-8.8-8.8 3-3Z" />
      <S d="M26 39h11" strokeWidth={2.4} opacity={0.75} />
    </>
  ),

  /* SabWebinar — screen with play. */
  sabwebinar: (
    <>
      <path
        fill="#fff"
        fillRule="evenodd"
        d="M13 11.5h22a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H13a3 3 0 0 1-3-3v-12a3 3 0 0 1 3-3Zm8.5 4.8v8.4a.8.8 0 0 0 1.22.68l6.8-4.2a.8.8 0 0 0 0-1.36l-6.8-4.2a.8.8 0 0 0-1.22.68Z"
      />
      <rect x={22} y={29.5} width={4} height={4.5} fill="#fff" />
      <rect x={16} y={34} width={16} height={3} rx={1.5} fill="#fff" />
    </>
  ),

  /* SabSheet — spreadsheet. */
  sabsheet: (
    <>
      <rect x={11.5} y={10} width={25} height={28} rx={3} fill="#fff" />
      <g stroke="#000" opacity={0.2} strokeWidth={1.8}>
        <path d="M13.5 18.5h21M13.5 25h21M13.5 31.5h21" />
        <path d="M24 12v24" />
      </g>
    </>
  ),

  /* SabShow — presentation board. */
  sabshow: (
    <>
      <circle cx={24} cy={10.4} r={1.9} fill="#fff" />
      <rect x={10} y={13} width={28} height={17} rx={2.6} fill="#fff" />
      <g fill="#000" opacity={0.24}>
        <rect x={15} y={21} width={3.2} height={6} rx={1} />
        <rect x={22.4} y={17.5} width={3.2} height={9.5} rx={1} />
        <rect x={29.8} y={23} width={3.2} height={4} rx={1} />
      </g>
      <S d="M24 30v4m0 0-6.2 4.6M24 34l6.2 4.6" strokeWidth={2.5} />
    </>
  ),

  /* SabTables — database. */
  sabtables: (
    <>
      <path
        fill="#fff"
        d="M12 14.6C12 12 17.4 10 24 10s12 2 12 4.6V33.4C36 36 30.6 38 24 38s-12-2-12-4.6V14.6Z"
      />
      <g fill="none" stroke="#000" opacity={0.2} strokeWidth={2}>
        <path d="M12 14.6C12 17.2 17.4 19.2 24 19.2s12-2 12-4.6" />
        <path d="M12 22.4C12 25 17.4 27 24 27s12-2 12-4.6" />
        <path d="M12 30.2C12 32.8 17.4 34.8 24 34.8s12-2 12-4.6" />
      </g>
    </>
  ),

  /* SabSprints — stopwatch. */
  sabsprints: (
    <>
      <rect x={21} y={9} width={6} height={4} rx={1.4} fill="#fff" />
      <circle cx={24} cy={26} r={11.5} fill="#fff" />
      <path fill="none" stroke="#000" opacity={0.28} strokeWidth={2.6} strokeLinecap="round" d="M24 26l5.4-6.2" />
      <circle cx={24} cy={26} r={2} fill="#000" opacity={0.28} />
    </>
  ),

  /* SabBugs — bug. */
  sabbugs: (
    <>
      <g stroke="#fff" strokeWidth={2.4} strokeLinecap="round">
        <path d="m16.5 20-5.5-3M16 27h-6M16.5 33 11 36M31.5 20l5.5-3M32 27h6M31.5 33l5.5 3" />
      </g>
      <circle cx={24} cy={14.5} r={4.2} fill="#fff" />
      <ellipse cx={24} cy={27} rx={8.4} ry={10.4} fill="#fff" />
      <path d="M24 18v18" stroke="#000" opacity={0.2} strokeWidth={2} strokeLinecap="round" />
    </>
  ),

  /* SabRequests — ticket. */
  sabrequests: (
    <>
      <path
        fill="#fff"
        d="M10 18a3 3 0 0 1 3-3h22a3 3 0 0 1 3 3v2.6a3.6 3.6 0 0 0 0 6.8V30a3 3 0 0 1-3 3H13a3 3 0 0 1-3-3v-2.6a3.6 3.6 0 0 0 0-6.8V18Z"
      />
      <path d="M29.5 17v14" stroke="#000" opacity={0.24} strokeWidth={2} strokeDasharray="2.6 3" strokeLinecap="round" />
    </>
  ),

  /* SabWorkerly — hard hat. */
  sabworkerly: (
    <>
      <path fill="#fff" d="M12.5 29.5a11.5 11.5 0 0 1 23 0h-23Z" />
      <rect x={9} y={29} width={30} height={4.5} rx={2.25} fill="#fff" />
      <rect x={22.4} y={17.5} width={3.2} height={9} rx={1.4} fill="#000" opacity={0.16} />
    </>
  ),

  /* SabPractice — graduation cap. */
  sabpractice: (
    <>
      <path fill="#fff" d="M24 12.5 39.5 18 24 23.5 8.5 18 24 12.5Z" />
      <path
        fill="#fff"
        d="M16.5 22.4v5.8c0 2 3.4 3.6 7.5 3.6s7.5-1.6 7.5-3.6v-5.8l-7 2.5a1.6 1.6 0 0 1-1 0l-7-2.5Z"
      />
      <S d="M37.5 19v7" strokeWidth={2.2} />
      <circle cx={37.5} cy={27.8} r={1.7} fill="#fff" />
    </>
  ),

  /* SabBI — bar chart. */
  sabbi: (
    <g fill="#fff">
      <rect x={11.5} y={24} width={6.4} height={13.5} rx={1.6} />
      <rect x={20.8} y={15} width={6.4} height={22.5} rx={1.6} />
      <rect x={30.1} y={20} width={6.4} height={17.5} rx={1.6} />
    </g>
  ),

  /* SabPrep — tuning sliders. */
  sabprep: (
    <>
      <g stroke="#fff" strokeWidth={2.6} strokeLinecap="round" opacity={0.55}>
        <path d="M12 16h24M12 24h24M12 32h24" />
      </g>
      <g fill="#fff">
        <circle cx={28.5} cy={16} r={3.4} />
        <circle cx={17} cy={24} r={3.4} />
        <circle cx={32.5} cy={32} r={3.4} />
      </g>
    </>
  ),

  /* SabSense — radar sweep. */
  sabsense: (
    <>
      <circle cx={18} cy={30} r={4} fill="#fff" />
      <S d="M18 19.4A10.6 10.6 0 0 1 28.6 30" strokeWidth={3} />
      <S d="M18 12a18 18 0 0 1 18 18" strokeWidth={3} opacity={0.6} />
    </>
  ),

  /* SabCreator — wrench. */
  sabcreator: (
    <path
      fill="#fff"
      d="M36.7 14.6a8.4 8.4 0 0 1-11 10.5L15.4 35.4a3.4 3.4 0 0 1-4.8-4.8l10.3-10.3a8.4 8.4 0 0 1 10.5-11l-5.2 5.2.9 4.5 4.5.9 5.1-5.3Z"
    />
  ),

  /* SabCatalyst — rocket. */
  sabcatalyst: (
    <>
      <path
        fill="#fff"
        fillRule="evenodd"
        d="M24 8.8c5.3 4.1 7.6 9.4 7.6 14.7 0 2.9-.6 5.6-1.6 8H18c-1-2.4-1.6-5.1-1.6-8 0-5.3 2.3-10.6 7.6-14.7Zm0 8a3.2 3.2 0 1 0 0 6.4 3.2 3.2 0 0 0 0-6.4Z"
      />
      <path fill="#fff" d="m17.2 26.6-5 7.2 6.4-1.7-1.4-5.5ZM30.8 26.6l5 7.2-6.4-1.7 1.4-5.5Z" />
      <path fill="#fff" opacity={0.8} d="M21.4 34.5h5.2c0 2.4-1 4.2-2.6 5.7-1.6-1.5-2.6-3.3-2.6-5.7Z" />
    </>
  ),

  /* SabOps — gauge. */
  sabops: (
    <>
      <S d="M11 31a13.2 13.2 0 0 1 26.4 0" strokeWidth={3.2} />
      <path fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" d="M24.2 31 31 22.6" />
      <circle cx={24} cy={31} r={2.6} fill="#fff" />
      <S d="M13.5 36h21" strokeWidth={2.4} opacity={0.6} />
    </>
  ),

  /* SabMonitor — monitor with pulse. */
  sabmonitor: (
    <>
      <rect x={10} y={12} width={28} height={19} rx={3} fill="#fff" />
      <path fill="none" stroke="#000" opacity={0.24} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" d="M13.5 22h4.8l2.8-4.6 3.8 8.6 2.8-5.4h5.8" />
      <rect x={22} y={31} width={4} height={4} fill="#fff" />
      <rect x={16} y={35} width={16} height={2.8} rx={1.4} fill="#fff" />
    </>
  ),

  /* SabLens — magnifier. */
  sablens: (
    <>
      <path
        fill="#fff"
        fillRule="evenodd"
        d="M21.5 11a10.5 10.5 0 1 1 0 21 10.5 10.5 0 0 1 0-21Zm0 4.2a6.3 6.3 0 1 0 0 12.6 6.3 6.3 0 0 0 0-12.6Z"
      />
      <path fill="none" stroke="#fff" strokeWidth={4.2} strokeLinecap="round" d="m29.8 29.8 7 7" />
    </>
  ),

  /* SabPublish — broadcast. */
  sabpublish: (
    <>
      <circle cx={16.5} cy={31.5} r={3.8} fill="#fff" />
      <S d="M13 21.8a13.7 13.7 0 0 1 13.2 13.2" strokeWidth={3.2} />
      <S d="M13 13a22.5 22.5 0 0 1 22 22" strokeWidth={3.2} />
    </>
  ),

  /* Settings — gear. */
  settings: (
    <>
      {Array.from({ length: 8 }, (_, i) => (
        <rect
          key={i}
          x={22.3}
          y={10.6}
          width={3.4}
          height={6.4}
          rx={1.6}
          fill="#fff"
          transform={`rotate(${i * 45} 24 24)`}
        />
      ))}
      <path
        fill="#fff"
        fillRule="evenodd"
        d="M24 15.6a8.4 8.4 0 1 1 0 16.8 8.4 8.4 0 0 1 0-16.8Zm0 5.1a3.3 3.3 0 1 0 0 6.6 3.3 3.3 0 0 0 0-6.6Z"
      />
    </>
  ),

  crm: (
    <g fill="#fff">
      <path d="M13 17.5h22a3 3 0 0 1 3 3V34a3 3 0 0 1-3 3H13a3 3 0 0 1-3-3V20.5a3 3 0 0 1 3-3Z" />
      <path d="M19.5 17.5V15a3 3 0 0 1 3-3h3a3 3 0 0 1 3 3v2.5h-3V15h-3v2.5h-3Z" />
      <rect x={10} y={24.5} width={28} height={2.6} fill="#000" opacity={0.18} />
    </g>
  ),
  sabcrm: (
    <>
      <circle cx={24} cy={17} r={5} fill="#fff" />
      <path fill="#fff" d="M13.5 36c0-6 4.6-10 10.5-10s10.5 4 10.5 10v.4a1.1 1.1 0 0 1-1.1 1.1H14.6a1.1 1.1 0 0 1-1.1-1.1V36Z" />
      <circle cx={34.5} cy={13.5} r={3.4} fill="#fff" opacity={0.7} />
    </>
  ),
  hrm: (
    <>
      <rect x={12} y={13} width={24} height={24} rx={3} fill="#fff" />
      <circle cx={24} cy={21.5} r={3.6} fill="#000" opacity={0.22} />
      <path fill="#000" opacity={0.22} d="M17.5 32.5c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6h-13Z" />
      <rect x={20} y={10.5} width={8} height={4.5} rx={1.6} fill="#fff" />
    </>
  ),
};

/* ── Logo component ──────────────────────────────────────────────────────── */

const APPS_BY_ID = new Map(SAB_APPS.map((app) => [app.id, app]));

export interface SabAppLogoProps extends Omit<SVGProps<SVGSVGElement>, "id"> {
  /** App id from the SAB_APPS registry (or "launchpad"). */
  appId: string;
  /** Accessible title; omit (default) when a parent already labels the control. */
  title?: string;
}

/**
 * A complete, self-contained macOS-style app icon: gradient squircle +
 * sheen + the app's filled white glyph. Scales losslessly — give it a
 * width/height (or className) and everything (radius, glyph, gloss)
 * scales with it.
 */
export function SabAppLogo({ appId, title, ...rest }: SabAppLogoProps) {
  const gradientId = React.useId();
  const { from, to } = appAccent(appId);
  const glyph = GLYPHS[appId];
  const FallbackIcon = !glyph ? APPS_BY_ID.get(appId)?.Icon : undefined;

  return (
    <svg
      viewBox="0 0 48 48"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={from} />
          <stop offset="100%" stopColor={to} />
        </linearGradient>
      </defs>

      {/* Squircle base. */}
      <rect width="48" height="48" rx="11" fill={`url(#${gradientId})`} />
      {/* Soft top sheen — the macOS depth cue. */}
      <path d="M0 0h48v15c-13 5.6-35 5.6-48 0Z" fill="#fff" opacity="0.16" />
      {/* Hairline inner highlight. */}
      <rect
        x="0.6"
        y="0.6"
        width="46.8"
        height="46.8"
        rx="10.5"
        fill="none"
        stroke="#fff"
        strokeOpacity="0.28"
        strokeWidth="1"
      />

      {glyph ??
        (FallbackIcon ? (
          /* Unknown app: its registry stroke icon, white, centred. */
          <FallbackIcon x={12} y={12} width={24} height={24} color="#fff" />
        ) : (
          <circle cx={24} cy={24} r={6} fill="#fff" />
        ))}
    </svg>
  );
}

/** True when an app has a bespoke glyph (vs the stroke-icon fallback). */
export function hasAppGlyph(appId: string): boolean {
  return appId in GLYPHS;
}
