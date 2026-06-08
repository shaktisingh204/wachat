import * as React from 'react';
import Link from 'next/link';
import { FileQuestion } from 'lucide-react';

import { Button, Card, CardBody, EmptyState } from '@/components/sabcrm/20ui';

export default function SabprepNotFound(): React.JSX.Element {
  return (
    <div className="20ui p-4 md:p-6">
      <Card>
        <CardBody>
          <EmptyState
            icon={FileQuestion}
            title="Recipe not found"
            description="This recipe may have been archived or never existed."
            action={
              <Button variant="primary" asChild>
                <Link href="/dashboard/sabprep">Back to recipes</Link>
              </Button>
            }
          />
        </CardBody>
      </Card>
    </div>
  );
}
