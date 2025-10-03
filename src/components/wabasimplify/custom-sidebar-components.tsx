
'use client';

import * as React from 'react';
import { Home, ShoppingBag, IndianRupee } from 'lucide-react';
import { SabNodeLogo } from '@/components/wabasimplify/logo';

export const GoogleIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg role="img" viewBox="0 0 24 24" {...props}><path fill="currentColor" d="M12.48 10.92v3.28h7.84c-.24 1.84-.85 3.18-1.73 4.1-1.02 1.08-2.58 1.98-4.48 1.98-3.79 0-7.17-3.22-7.17-7.22s3.38-7.22 7.17-7.22c2.23 0 3.63.92 4.48 1.75l2.72-2.72C19.62 3.39 16.67 2 12.48 2 7.01 2 2.56 6.18 2.56 12s4.45 10 9.92 10c2.79 0 5.1-1 6.88-2.84 1.92-1.92 2.58-4.75 2.58-7.17 0-.66-.07-1.32-.19-1.98z"/></svg>
);

export const OutlookIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 256 256" {...props}>
        <path fill="currentColor" d="M228 64a12 12 0 0 0-12 12v56a12 12 0 0 1-12 12H76a12 12 0 0 1-12-12V88h60.46a12 12 0 0 0 10.7-5.83l24-40A12 12 0 0 0 148.46 28H104a12 12 0 0 0-10.7 5.83l-32 53.33A12 12 0 0 0 64 96H28a12 12 0 0 0-12 12v68a12 12 0 0 0 12 12h188a12 12 0 0 0 12-12v-56a12 12 0 0 1 12-12h12a12 12 0 0 0 0-24zm-12 92H28v-68h36v20a12 12 0 0 0 12 12h140z"/>
    </svg>
);


export const MetaIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 290 191" {...props}>
      <defs>
        <linearGradient id="Grad_Logo1" x1="61" y1="117" x2="259" y2="127" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0064e1" offset="0"/>
          <stop stopColor="#0064e1" offset="0.4"/>
          <stop stopColor="#0073ee" offset="0.83"/>
          <stop stopColor="#0082fb" offset="1"/>
        </linearGradient>
        <linearGradient id="Grad_Logo2" x1="45" y1="139" x2="45" y2="66" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0082fb" offset="0"/>
          <stop stopColor="#0064e0" offset="1"/>
        </linearGradient>
      </defs>
      <path id="Logo0" fill="#0081fb" d="m31.06,125.96c0,10.98 2.41,19.41 5.56,24.51 4.13,6.68 10.29,9.51 16.57,9.51 8.1,0 15.51-2.01 29.79-21.76 11.44-15.83 24.92-38.05 33.99-51.98l15.36-23.6c10.67-16.39 23.02-34.61 37.18-46.96 11.56-10.08 24.03-15.68 36.58-15.68 21.07,0 41.14,12.21 56.5,35.11 16.81,25.08 24.97,56.67 24.97,89.27 0,19.38-3.82,33.62-10.32,44.87-6.28,10.88-18.52,21.75-39.11,21.75l0-31.02c17.63,0 22.03-16.2 22.03-34.74 0-26.42-6.16-55.74-19.73-76.69-9.63-14.86-22.11-23.94-35.84-23.94-14.85,0-26.8,11.2-40.23,31.17-7.14,10.61-14.47,23.54-22.7,38.13l-9.06,16.05c-18.2,32.27-22.81,39.62-31.91,51.75-15.95,21.24-29.57,29.29-47.5,29.29-21.27,0-34.72-9.21-43.05-23.09-6.8-11.31-10.14-26.15-10.14-43.06z"/>
      <path id="Logo1" fill="url(#Grad_Logo1)" d="m24.49,37.3c14.24-21.95 34.79-37.3 58.36-37.3 13.65,0 27.22,4.04 41.39,15.61 15.5,12.65 32.02,33.48 52.63,67.81l7.39,12.32c17.84,29.72 27.99,45.01 33.93,52.22 7.64,9.26 12.99,12.02 19.94,12.02 17.63,0 22.03-16.2 22.03-34.74l27.4-.86c0,19.38-3.82,33.62-10.32,44.87-6.28,10.88-18.52,21.75-39.11,21.75-12.8,0-24.14-2.78-36.68-14.61-9.64-9.08-20.91-25.21-29.58-39.71l-25.79-43.08c-12.94-21.62-24.81-37.74-31.68-45.04-7.39-7.85-16.89-17.33-32.05-17.33-12.27,0-22.69,8.61-31.41,21.78z"/>
      <path id="Logo2" fill="url(#Grad_Logo2)" d="m82.35,31.23c-12.27,0-22.69,8.61-31.41,21.78-12.33,18.61-19.88,46.33-19.88,72.95 0,10.98 2.41,19.41 5.56,24.51l-26.48,17.44c-6.8-11.31-10.14-26.15-10.14-43.06 0-30.75 8.44-62.8 24.49-87.55 14.24-21.95 34.79-37.3 58.36-37.3z"/>
    </svg>
);

export const FacebookIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
);

export const SeoIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <circle cx="11" cy="11" r="8"></circle>
        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        <path d="M7 11h8"></path>
        <path d="m11 7 4 4-4 4"></path>
    </svg>
);

export const WaPayIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <IndianRupee {...props} />
);

export const SabNodeBrandLogo = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 200 50" xmlns="http://www.w3.org/2000/svg" {...props}>
    <g fillRule="evenodd">
      <path fill="#29B6F6" d="m2.5 16.5 10 15 10-15z"/>
      <path fill="#AB47BC" d="m15.5 31.5 10-15 10 15z"/>
      <path fill="#FFA726" d="m28.5 16.5 10 15 10-15z"/>
    </g>
  </svg>
);

export const WhatsAppIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16" {...props}>
        <path d="M13.601 2.326A7.85 7.85 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.9 7.9 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.9 7.9 0 0 0 13.6 2.326zM7.994 14.521a6.6 6.6 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.56 6.56 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592m3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.73.73 0 0 0-.529.247c-.182.198-.691.677-.691 1.654s.71 1.916.81 2.049c.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232"/>
    </svg>
);

export const InstagramIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <rect width="20" height="20" x="2" y="2" rx="5" ry="5"/>
        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
        <line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/>
    </svg>
);

export const CustomEcommerceIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <ShoppingBag {...props} />
);


export const WachatSidebarTopLogo = (props: React.SVGProps<SVGSVGElement>) => (
    <SabNodeLogo {...props} />
);

export { Home };
