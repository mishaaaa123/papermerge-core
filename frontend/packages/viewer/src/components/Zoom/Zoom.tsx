import {Group} from "@mantine/core"
import {IconChevronLeft, IconChevronRight, IconMaximize, IconZoomIn, IconZoomOut} from "@tabler/icons-react"
import classes from "./Zoom.module.css"

interface Args {
  pageNumber: number
  pageTotal: number
  onZoomInClick?: () => void
  onZoomOutClick?: () => void
  onFitClick?: () => void
  onPreviousPageClick?: () => void
  onNextPageClick?: () => void
}

export default function Zoom({
  pageNumber,
  pageTotal,
  onZoomInClick,
  onZoomOutClick,
  onFitClick,
  onPreviousPageClick,
  onNextPageClick
}: Args) {
  return (
    <Group justify={"center"} className={classes.zoom}>
      <IconChevronLeft 
        onClick={onPreviousPageClick} 
        style={{cursor: pageNumber > 1 ? "pointer" : "not-allowed", opacity: pageNumber > 1 ? 1 : 0.5}}
      />
      {pageNumber} / {pageTotal}
      <IconChevronRight 
        onClick={onNextPageClick} 
        style={{cursor: pageNumber < pageTotal ? "pointer" : "not-allowed", opacity: pageNumber < pageTotal ? 1 : 0.5}}
      />
      <IconZoomIn onClick={onZoomInClick} />
      <IconZoomOut onClick={onZoomOutClick} />
      <IconMaximize onClick={onFitClick} />
    </Group>
  )
}
