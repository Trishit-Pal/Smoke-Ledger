import Link from 'next/link';
import { Card } from '@web/components/ui/Card';
import { Text } from '@web/components/ui/Text';

export default function NotFound(): React.ReactElement {
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-lg">
      <div className="w-full max-w-sm">
        <Card>
          <div className="flex flex-col gap-md text-center">
            <Text variant="caption" muted>
              404
            </Text>
            <Text variant="h2">Page not found</Text>
            <Text variant="small" muted>
              We could not find that page. It might have been moved or the link is incorrect.
            </Text>
            <Link href="/" className="text-accent-ink text-small font-medium hover:opacity-80 mt-sm">
              Back to home
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
