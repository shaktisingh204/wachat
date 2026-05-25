import React from 'react';
import { QueryBuilder, Field } from 'react-querybuilder';

export function TestRQB() {
  const fields: Field[] = [{ name: 'firstName', label: 'First Name' }];
  return <QueryBuilder fields={fields} />;
}
