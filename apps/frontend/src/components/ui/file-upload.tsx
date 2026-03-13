import { cn } from "@/lib/utils"
import {
  Children,
  cloneElement,
  createContext,
  useContext,
  useEffect,
  useState,
} from "react"
import { createPortal } from "react-dom"
import { useDropzone } from "react-dropzone"

type FileUploadContextValue = {
  isDragActive: boolean
  openFilePicker: () => void
  onFilesAdded: (files: File[]) => void
  multiple?: boolean
  disabled?: boolean
}

const FileUploadContext = createContext<FileUploadContextValue | null>(null)

export type FileUploadProps = {
  onFilesAdded: (files: File[]) => void
  children: React.ReactNode
  multiple?: boolean
  accept?: string
  disabled?: boolean
}

function FileUpload({
  onFilesAdded,
  children,
  multiple = true,
  accept,
  disabled = false,
}: FileUploadProps) {
  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop: (acceptedFiles) => {
      if (multiple) {
        onFilesAdded(acceptedFiles)
      } else {
        onFilesAdded(acceptedFiles.slice(0, 1))
      }
    },
    multiple,
    noClick: true,
    noKeyboard: true,
    disabled,
    ...(accept ? { accept: parseAccept(accept) } : {}),
  })

  return (
    <FileUploadContext.Provider
      value={{ isDragActive, openFilePicker: open, onFilesAdded, multiple, disabled }}
    >
      <div {...getRootProps()} className="contents">
        <input {...getInputProps()} />
        {children}
      </div>
    </FileUploadContext.Provider>
  )
}

/** Convert "image/*,.pdf" style accept string to react-dropzone's Accept object */
function parseAccept(accept: string): Record<string, string[]> {
  const result: Record<string, string[]> = {}
  for (const part of accept.split(",")) {
    const trimmed = part.trim()
    if (trimmed.startsWith(".")) {
      const mime = "application/octet-stream"
      result[mime] = [...(result[mime] ?? []), trimmed]
    } else {
      result[trimmed] = []
    }
  }
  return result
}

export type FileUploadTriggerProps =
  React.ComponentPropsWithoutRef<"button"> & {
    asChild?: boolean
  }

function FileUploadTrigger({
  asChild = false,
  className,
  children,
  ...props
}: FileUploadTriggerProps) {
  const context = useContext(FileUploadContext)
  const handleClick = () => context?.openFilePicker()

  if (asChild) {
    const child = Children.only(children) as React.ReactElement<
      React.HTMLAttributes<HTMLElement>
    >
    return cloneElement(child, {
      ...props,
      role: "button",
      className: cn(className, child.props.className),
      onClick: (e: React.MouseEvent) => {
        e.stopPropagation()
        handleClick()
        child.props.onClick?.(e as React.MouseEvent<HTMLElement>)
      },
    })
  }

  return (
    <button
      type="button"
      className={className}
      onClick={handleClick}
      {...props}
    >
      {children}
    </button>
  )
}

type FileUploadContentProps = React.HTMLAttributes<HTMLDivElement>

function FileUploadContent({ className, ...props }: FileUploadContentProps) {
  const context = useContext(FileUploadContext)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    return () => setMounted(false)
  }, [])

  if (!context?.isDragActive || !mounted || context?.disabled) {
    return null
  }

  const content = (
    <div
      className={cn(
        "bg-background/80 fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm",
        "animate-in fade-in-0 slide-in-from-bottom-10 zoom-in-90 duration-150",
        className
      )}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault()
        if (e.dataTransfer?.files.length) {
          const files = Array.from(e.dataTransfer.files)
          context.onFilesAdded(context.multiple ? files : files.slice(0, 1))
        }
      }}
      {...props}
    />
  )

  return createPortal(content, document.body)
}

export { FileUpload, FileUploadTrigger, FileUploadContent }
