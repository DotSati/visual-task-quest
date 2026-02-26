import { useState } from "react";
import { format } from "date-fns";
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

interface DateChangeDialogProps {
  open: boolean;
  onConfirm: (newDate: Date) => void;
  onCancel: () => void;
  onSkip: () => void;
  taskTitle: string;
  currentDate: string;
}

export function DateChangeDialog({
  open,
  onConfirm,
  onCancel,
  onSkip,
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
            {currentDate
              ? <>The task "<span className="font-medium">{taskTitle}</span>" has an overdue date ({currentDate}). Please select a new due date before moving it.</>
              : <>The task "<span className="font-medium">{taskTitle}</span>" has no due date. Please select a due date before moving it.</>
            }
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-center py-2">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={setSelectedDate}
            disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
            initialFocus
            className={cn("p-3 pointer-events-auto rounded-md border")}
          />
        </div>
        {selectedDate && (
          <p className="text-sm text-muted-foreground text-center">
            New date: <span className="font-medium text-foreground">{format(selectedDate, "PPP")}</span>
          </p>
        )}
        <DialogFooter className="flex-row gap-2 sm:justify-between">
          <Button variant="ghost" onClick={onSkip} className="mr-auto">
            Skip & Move
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button onClick={handleConfirm} disabled={!selectedDate}>
              Move Task
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
