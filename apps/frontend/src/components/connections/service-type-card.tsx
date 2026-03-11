import { Link } from '@tanstack/react-router'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import type { ConnectionTypeMetadata } from '@/lib/constants/connection-types'

interface ServiceTypeCardProps {
  meta: ConnectionTypeMetadata
}

export function ServiceTypeCard({ meta }: ServiceTypeCardProps) {
  return (
    <Link to="/connections/create/$type" params={{ type: meta.type }}>
      <Card className="cursor-pointer transition-all hover:shadow-md hover:border-primary/50">
        <CardContent className="flex flex-col gap-3 p-4">
          <div className="flex items-start justify-between">
            <div className="rounded-lg bg-muted p-2.5">
              <img src={meta.icon} alt={meta.label} className="size-5" />
            </div>
            <Badge variant={meta.mcpSource === 'official' ? 'default' : 'secondary'} className="text-xs">
              {meta.mcpSource === 'official' ? 'Official' : 'Community'}
            </Badge>
          </div>
          <div>
            <h3 className="font-medium">{meta.label}</h3>
            <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
              {meta.description}
            </p>
          </div>
          <Badge variant="outline" className="w-fit text-xs">
            {meta.category}
          </Badge>
        </CardContent>
      </Card>
    </Link>
  )
}
