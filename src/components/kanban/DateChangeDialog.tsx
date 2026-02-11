import { useState } from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface DateChangeDialogProps {
  open: boolean;
  onConfirm: (newDate: Date) => void;
  onCancel: () => void;
  taskTitle: string;
  currentDate: string;
}

export function DateChangeDialog({
  open,
  onConfirm,
  onCancel,
  taskTitle,
  currentDate,
}: DateChangeDialogProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);

  const handleConfirm = () => {
    if (selectedDate) {
      onConfirm(selectedDate);
      setSelectedDate(undefined);
    }
  };

  const handleCancel = () => {
    setSelectedDate(undefined);
    onCancel();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) handleCancel(); }}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Update Due Date</DialogTitle>
          <DialogDescription>
            The task "<span className="font-medium">{taskTitle}</span>" has an overdue date ({currentDate}). Please select a new due date before moving it.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !selectedDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {selectedDate ? format(selectedDate, "PPP") : "Pick a new date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!selectedDate}>
            Move Task
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
