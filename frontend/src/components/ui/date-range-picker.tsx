import * as React from "react"
import { format } from "date-fns"
import type { DateRange } from "react-day-picker"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface DateRangePickerProps {
  onUpdate?: (values: { range: DateRange | undefined }) => void
  initialDateFrom?: Date | string
  initialDateTo?: Date | string
  className?: string
}

export function DateRangePicker({
  className,
  onUpdate,
  initialDateFrom,
  initialDateTo,
}: DateRangePickerProps) {
  const [fromDate, setFromDate] = React.useState(
    initialDateFrom ? format(new Date(initialDateFrom), "yyyy-MM-dd") : ""
  )
  const [toDate, setToDate] = React.useState(
    initialDateTo ? format(new Date(initialDateTo), "yyyy-MM-dd") : ""
  )

  React.useEffect(() => {
    if (onUpdate) {
      const range: DateRange | undefined = {
        from: fromDate ? new Date(fromDate) : undefined,
        to: toDate ? new Date(toDate) : undefined,
      }
      onUpdate({ range })
    }
  }, [fromDate, toDate])

  return (
    <div className={`grid grid-cols-2 gap-2 ${className || ""}`}>
      <div className="space-y-1">
        <Label htmlFor="from-date" className="text-xs">From</Label>
        <Input
          id="from-date"
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          className="text-sm"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="to-date" className="text-xs">To</Label>
        <Input
          id="to-date"
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          className="text-sm"
        />
      </div>
    </div>
  )
}