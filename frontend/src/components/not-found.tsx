import { Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyHeader, EmptyTitle } from "@/components/ui/empty";

export function NotFound() {
  return (
    <div className="flex h-screen items-center justify-center pb-32">
      <Empty>
        <EmptyHeader>
          <EmptyTitle>404 - Not Found</EmptyTitle>
        </EmptyHeader>
        <EmptyContent>
          <Button asChild>
            <Link to="/">回到首页</Link>
          </Button>
        </EmptyContent>
      </Empty>
    </div>
  );
}
