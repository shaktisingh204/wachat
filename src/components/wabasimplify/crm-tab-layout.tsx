
'use client';

import React from 'react';

// This component is deprecated and its logic has been moved to the main CRM layout.
// It is kept here to prevent breaking changes in other files that might still import it.
export const CrmTabLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <>{children}</>;
};
