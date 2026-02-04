'use client';

import * as React from "react";
import { format, subMonths, addMonths } from "date-fns";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

export function MonthPicker() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const pathname = usePathname();

    const currentMonthStr = searchParams.get('month');
    const currentYearStr = searchParams.get('year');

    const date = React.useMemo(() => {
        if (currentMonthStr && currentYearStr) {
            return new Date(parseInt(currentYearStr), parseInt(currentMonthStr) - 1, 1);
        }
        return new Date(); // Default to now
    }, [currentMonthStr, currentYearStr]);

    const handleMonthChange = (newDate: Date) => {
        const params = new URLSearchParams(searchParams);
        params.set('month', (newDate.getMonth() + 1).toString());
        params.set('year', newDate.getFullYear().toString());
        router.push(`${pathname}?${params.toString()}`);
    };

    const nextMonth = () => handleMonthChange(addMonths(date, 1));
    const prevMonth = () => handleMonthChange(subMonths(date, 1));

    return (
        <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={prevMonth}>
                <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="border rounded-md px-4 py-2 min-w-[150px] text-center font-medium">
                {format(date, 'MMMM yyyy')}
            </div>
            <Button variant="outline" size="icon" onClick={nextMonth} disabled={date > new Date()}>
                <ChevronRight className="h-4 w-4" />
            </Button>
        </div>
    );
}
