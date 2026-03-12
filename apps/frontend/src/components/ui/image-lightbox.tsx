import { Dialog, DialogContent } from '@/components/ui/dialog'

export function ImageLightbox(props: {
  open: boolean
  onOpenChange: (open: boolean) => void
  src: string
  alt?: string
}) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-none p-2 sm:w-[calc(100vw-2.5rem)] sm:max-w-6xl lg:max-w-7xl 2xl:max-w-[88rem] 2xl:p-3" showCloseButton>
        <img
          src={props.src}
          alt={props.alt ?? ''}
          className="max-h-[86vh] w-full object-contain"
        />
      </DialogContent>
    </Dialog>
  )
}
