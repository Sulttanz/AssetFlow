import { useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertTriangle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Loader2,
  Plus,
  ShieldCheck,
  Snowflake,
  Trash2,
} from "lucide-react";

type CalendarChange = {
  id: string;
  changeNumber: string;
  title: string;
  status: string;
  type: string;
  scheduledStart: string;
  scheduledEnd: string;
  risk: string | null;
};

type Blackout = {
  id: string;
  title: string;
  reason: string | null;
  startDate: string;
  endDate: string;
  createdAt: string;
};

type CalendarResponse = { changes: CalendarChange[]; blackouts: Blackout[] };
type BlackoutForm = { title: string; reason: string; startDate: string; endDate: string };

const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const blankForm: BlackoutForm = { title: "", reason: "", startDate: "", endDate: "" };
const pad = (value: number) => String(value).padStart(2, "0");
const isoDate = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const localDate = (value: string) => {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  return new Date(year, month - 1, day);
};
const dateOnly = (value: string) => value.slice(0, 10);
export function changeWindowsOverlap(
  left: Pick<CalendarChange, "scheduledStart" | "scheduledEnd">,
  right: Pick<CalendarChange, "scheduledStart" | "scheduledEnd">,
) {
  const leftStart = Date.parse(left.scheduledStart);
  const leftEnd = Date.parse(left.scheduledEnd);
  const rightStart = Date.parse(right.scheduledStart);
  const rightEnd = Date.parse(right.scheduledEnd);
  return Number.isFinite(leftStart) && Number.isFinite(leftEnd) &&
    Number.isFinite(rightStart) && Number.isFinite(rightEnd) &&
    leftStart < rightEnd && rightStart < leftEnd;
}
export function blackoutOverlapsChange(
  change: Pick<CalendarChange, "scheduledStart" | "scheduledEnd">,
  blackout: Pick<Blackout, "startDate" | "endDate">,
) {
  return dateOnly(change.scheduledStart) <= blackout.endDate &&
    dateOnly(change.scheduledEnd) >= blackout.startDate;
}
const monthTitle = (date: Date) =>
  new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(date);
const timeLabel = (value: string) => {
  if (!value || !value.includes("T")) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(date);
};
const readableDate = (value: string) =>
  new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(localDate(value));
const titleCase = (value: string) =>
  value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

function getVisibleDays(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const end = new Date(last);
  end.setDate(last.getDate() + (6 - last.getDay()));
  const days: Date[] = [];
  for (const cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
    days.push(new Date(cursor));
  }
  return days;
}

function EventPill({ change, collision }: { change: CalendarChange; collision: boolean }) {
  const start = timeLabel(change.scheduledStart);
  const end = timeLabel(change.scheduledEnd);
  const time = start ? `${start}${end ? `–${end}` : ""}` : "";
  const riskTone =
    change.risk === "critical" || change.risk === "high"
      ? "border-l-[#bd554b] bg-[#fff0ec] text-[#853d35] hover:bg-[#ffe7e0]"
      : change.risk === "medium"
        ? "border-l-[#bb852d] bg-[#fff6df] text-[#75541f] hover:bg-[#ffefc8]"
        : "border-l-[#39796b] bg-[#e8f3ee] text-[#285b50] hover:bg-[#dcece5]";

  return (
    <Link
      href={`/changes?approval=${encodeURIComponent(change.id)}`}
      title={`${change.changeNumber} · ${change.title}${time ? ` · ${time}` : ""}`}
      className={`group block min-w-0 rounded-r border-l-[3px] px-1.5 py-1 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#245e53] ${riskTone} ${collision ? "ring-1 ring-inset ring-[#b65b4b]" : ""}`}
    >
      <span className="flex min-w-0 items-center gap-1">
        {collision && <AlertTriangle className="h-3 w-3 shrink-0 text-[#a7483e]" aria-label="Collision" />}
        <span className="truncate font-mono text-[9px] font-bold tracking-[-.02em] sm:text-[10px]">
          {change.changeNumber}
        </span>
        {time && <span className="ml-auto hidden shrink-0 font-mono text-[9px] opacity-70 xl:inline">{time}</span>}
      </span>
      <span className="block truncate text-[10px] leading-4 sm:text-[11px]">{change.title}</span>
    </Link>
  );
}

export default function ChangeCalendar({ canManage }: { canManage: boolean }) {
  const queryClient = useQueryClient();
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Blackout | null>(null);
  const [form, setForm] = useState<BlackoutForm>(blankForm);
  const [deleteTarget, setDeleteTarget] = useState<Blackout | null>(null);
  const [actionError, setActionError] = useState("");

  const days = useMemo(() => getVisibleDays(month), [month]);
  const from = isoDate(days[0]);
  const to = isoDate(days[days.length - 1]);
  const queryKey = ["/api/changes/calendar", from, to];

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<CalendarResponse>({
    queryKey,
    queryFn: async () => (await apiRequest("GET", `/api/changes/calendar?from=${from}&to=${to}`)).json(),
  });

  const saveBlackout = useMutation({
    mutationFn: async (payload: BlackoutForm) => {
      const body = {
        title: payload.title.trim(),
        reason: payload.reason.trim() || null,
        startDate: payload.startDate,
        endDate: payload.endDate,
      };
      const response = editing
        ? await apiRequest("PUT", `/api/change-blackouts/${encodeURIComponent(editing.id)}`, body)
        : await apiRequest("POST", "/api/change-blackouts", body);
      return response.json() as Promise<Blackout>;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/changes/calendar"] });
      setDialogOpen(false);
      setActionError("");
    },
    onError: (err: Error) => setActionError(err.message || "Unable to save this blackout period."),
  });

  const deleteBlackout = useMutation({
    mutationFn: async (blackout: Blackout) =>
      apiRequest("DELETE", `/api/change-blackouts/${encodeURIComponent(blackout.id)}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/changes/calendar"] });
      setDeleteTarget(null);
      setActionError("");
    },
    onError: (err: Error) => setActionError(err.message || "Unable to delete this blackout period."),
  });

  const changes = data?.changes ?? [];
  const blackouts = data?.blackouts ?? [];
  const monthChanges = changes.filter((change) => {
    const start = dateOnly(change.scheduledStart);
    const end = dateOnly(change.scheduledEnd || change.scheduledStart);
    return start <= to && end >= from;
  });
  const dayRecords = (day: Date) => {
    const key = isoDate(day);
    const dayChanges = monthChanges.filter((change) => {
      const start = dateOnly(change.scheduledStart);
      const end = dateOnly(change.scheduledEnd || change.scheduledStart);
      return start <= key && end >= key;
    });
    const dayBlackouts = blackouts.filter((blackout) => blackout.startDate <= key && blackout.endDate >= key);
    const collisions = new Set(dayChanges
      .filter((change) =>
        dayBlackouts.some((blackout) => blackoutOverlapsChange(change, blackout)) ||
        dayChanges.some((other) => other.id !== change.id && changeWindowsOverlap(change, other)),
      )
      .map((change) => change.id));
    return { dayChanges, dayBlackouts, collisions };
  };

  function startCreate() {
    setEditing(null);
    setForm(blankForm);
    setActionError("");
    setDialogOpen(true);
  }

  function startEdit(blackout: Blackout) {
    setEditing(blackout);
    setForm({
      title: blackout.title,
      reason: blackout.reason ?? "",
      startDate: blackout.startDate.slice(0, 10),
      endDate: blackout.endDate.slice(0, 10),
    });
    setActionError("");
    setDialogOpen(true);
  }

  function updateField(key: keyof BlackoutForm, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function submitBlackout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActionError("");
    saveBlackout.mutate(form);
  }

  return (
    <section className="overflow-hidden rounded-xl border border-[#d4dfda] bg-[#fcfdfb] shadow-[0_8px_28px_rgba(37,69,57,.055)]">
      <header className="flex flex-col gap-4 border-b border-[#dce5e0] bg-[#f3f7f4] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-[#ccddd4] bg-[#e4efe9] text-[#245c50]">
            <CalendarDays className="h-[18px] w-[18px]" />
          </span>
          <div>
            <h2 className="text-base font-semibold tracking-[-.025em] text-[#203b34]">Change calendar</h2>
            <p className="mt-0.5 text-xs text-[#64766f]">Release windows and protected service periods</p>
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 sm:justify-end">
          <div className="flex items-center rounded-md border border-[#cfdbd5] bg-white p-0.5">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Previous month"
              className="h-8 w-8 text-[#51645d] hover:bg-[#edf4ef] hover:text-[#1f5146]"
              onClick={() => setMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-[132px] px-2 text-center text-sm font-semibold text-[#29463d]">{monthTitle(month)}</div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Next month"
              className="h-8 w-8 text-[#51645d] hover:bg-[#edf4ef] hover:text-[#1f5146]"
              onClick={() => setMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Button
            type="button"
            variant="outline"
            className="h-9 border-[#cbd9d2] bg-white px-3 text-xs font-semibold text-[#275b4f] hover:bg-[#edf5f0]"
            onClick={() => setMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}
          >
            Today
          </Button>
          {canManage && (
            <Button
              type="button"
              className="h-9 bg-[#245e53] px-3 text-xs font-semibold text-white hover:bg-[#194b41]"
              onClick={startCreate}
            >
              <Plus className="mr-1.5 h-4 w-4" />
              <span className="hidden sm:inline">Add blackout</span>
              <span className="sm:hidden">Blackout</span>
            </Button>
          )}
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-[#e4eae6] px-4 py-2.5 text-[11px] text-[#5c6d66] sm:px-5">
        <span className="inline-flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-sm bg-[#39796b]" /> Planned change</span>
        <span className="inline-flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-sm bg-[#c79a45]" /> Blackout period</span>
        <span className="inline-flex items-center gap-2"><AlertTriangle className="h-3.5 w-3.5 text-[#ad4d42]" /> Collision / blackout overlap</span>
        <span className="ml-auto hidden items-center gap-1.5 text-[10px] text-[#76857f] sm:inline-flex">
          <Clock3 className="h-3.5 w-3.5" /> Times shown in your local timezone
        </span>
      </div>

      {isError ? (
        <div className="m-4 flex flex-col items-start gap-3 rounded-lg border border-[#e4c7c1] bg-[#fff7f4] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#a94f43]" />
            <div>
              <p className="text-sm font-semibold text-[#713d36]">Calendar could not be loaded</p>
              <p className="mt-1 break-words text-xs text-[#805850]">{error instanceof Error ? error.message : "The server did not return calendar data."}</p>
            </div>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => refetch()} className="border-[#d8b7af] text-[#75453d] hover:bg-[#fff0eb]">
            Try again
          </Button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[700px]">
            <div className="grid grid-cols-7 border-b border-[#dce5e0] bg-[#f8faf8]">
              {weekdays.map((weekday) => (
                <div key={weekday} className="px-2 py-2 text-center text-[10px] font-bold uppercase tracking-[.13em] text-[#73827b] sm:py-2.5">
                  {weekday}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {days.map((day, index) => {
                const key = isoDate(day);
                const inMonth = day.getMonth() === month.getMonth();
                const today = key === isoDate(new Date());
                const { dayChanges, dayBlackouts, collisions } = dayRecords(day);
                return (
                  <div
                    key={key}
                    className={`relative min-h-[114px] border-b border-r border-[#e5ebe7] p-1.5 transition-colors sm:min-h-[132px] sm:p-2 ${index % 7 === 6 ? "border-r-0" : ""} ${inMonth ? "bg-[#fcfdfb]" : "bg-[#f7f9f7]"} ${today ? "bg-[#f2f7f3]" : ""}`}
                  >
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className={`grid h-6 w-6 place-items-center rounded-full text-[11px] font-semibold ${today ? "bg-[#245e53] text-white" : inMonth ? "text-[#42564e]" : "text-[#a7b1ac]"}`}>
                        {day.getDate()}
                      </span>
                      {dayChanges.length + dayBlackouts.length > 0 && (
                        <span className="font-mono text-[9px] text-[#8b9992]">{dayChanges.length + dayBlackouts.length}</span>
                      )}
                    </div>
                    <div className="space-y-1">
                      {dayBlackouts.slice(0, 2).map((blackout) => (
                        <div
                          key={blackout.id}
                          className={`group rounded-r border-l-[3px] border-[#bb8b37] bg-[#fff4d9] px-1.5 py-1 text-[#70551f] ${canManage ? "cursor-pointer hover:bg-[#ffedc0] focus-within:ring-2 focus-within:ring-[#a2782d]" : ""}`}
                          title={`${blackout.title}${blackout.reason ? ` · ${blackout.reason}` : ""}`}
                        >
                          <div className="flex items-center gap-1">
                            <Snowflake className="h-3 w-3 shrink-0" />
                            <span className="truncate text-[10px] font-semibold">{blackout.title}</span>
                            {canManage && (
                              <span className="ml-auto flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                                <button
                                  type="button"
                                  aria-label={`Edit blackout: ${blackout.title}`}
                                  onClick={() => startEdit(blackout)}
                                  className="rounded px-1 text-[9px] font-bold uppercase tracking-wide hover:bg-[#f6dfa9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a2782d]"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  aria-label={`Delete blackout: ${blackout.title}`}
                                  onClick={() => { setActionError(""); setDeleteTarget(blackout); }}
                                  className="grid h-5 w-5 place-items-center rounded hover:bg-[#f6dfa9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a2782d]"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                      {dayBlackouts.length > 2 && (
                        <p className="pl-1 text-[9px] text-[#876a32]">+{dayBlackouts.length - 2} more blackout{dayBlackouts.length > 3 ? "s" : ""}</p>
                      )}
                      {dayChanges.slice(0, 3).map((change) => (
                        <EventPill
                          key={change.id}
                          change={change}
                          collision={collisions.has(change.id)}
                        />
                      ))}
                      {dayChanges.length > 3 && (
                        <p className="pl-1 text-[9px] font-medium text-[#65776f]">+{dayChanges.length - 3} more change{dayChanges.length > 4 ? "s" : ""}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {!isLoading && changes.length === 0 && blackouts.length === 0 && (
              <div className="flex items-center justify-center gap-3 border-t border-[#e7ede9] bg-[#fafcfb] px-4 py-5 text-sm text-[#65776f]">
                <ShieldCheck className="h-4 w-4 text-[#4b8375]" />
                No planned changes or blackout periods in this view.
              </div>
            )}
          </div>
        </div>
      )}

      {isLoading && (
        <div className="absolute inset-x-0 z-10 mx-4 mt-3 rounded-lg border border-[#dce5e0] bg-[#fcfdfb]/95 p-3 shadow-sm sm:mx-5">
          <div className="flex items-center gap-3">
            <Loader2 className="h-4 w-4 animate-spin text-[#39796b]" />
            <span className="text-xs font-medium text-[#586e65]">Loading release calendar…</span>
            <span className="ml-auto h-2 w-24 animate-pulse rounded bg-[#e4ece7]" />
          </div>
        </div>
      )}

      <footer className="flex flex-col gap-1.5 border-t border-[#e1e8e3] bg-[#f8faf8] px-4 py-3 text-[10px] text-[#73827b] sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <span>{monthChanges.length} planned change{monthChanges.length === 1 ? "" : "s"} · {blackouts.length} blackout period{blackouts.length === 1 ? "" : "s"}</span>
        <span>Overlapping timed changes and all-day blackout conflicts are flagged.</span>
      </footer>

      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setActionError(""); }}>
        <DialogContent className="border-[#d5e0da] bg-[#fcfdfb] sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="text-[#203b34]">{editing ? "Edit blackout period" : "Add blackout period"}</DialogTitle>
            <DialogDescription>
              Protect a service window from planned releases. Blackouts apply to every calendar day in the selected range.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitBlackout} className="space-y-4">
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold text-[#425b51]">Period name</span>
              <Input
                autoFocus
                required
                maxLength={120}
                value={form.title}
                onChange={(event) => updateField("title", event.target.value)}
                placeholder="e.g. Quarter-end freeze"
                className="border-[#cfdcd5] bg-white focus-visible:ring-[#39796b]"
              />
            </label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-[#425b51]">Start date</span>
                <Input
                  type="date"
                  required
                  value={form.startDate}
                  onChange={(event) => updateField("startDate", event.target.value)}
                  className="border-[#cfdcd5] bg-white focus-visible:ring-[#39796b]"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-[#425b51]">End date</span>
                <Input
                  type="date"
                  required
                  min={form.startDate || undefined}
                  value={form.endDate}
                  onChange={(event) => updateField("endDate", event.target.value)}
                  className="border-[#cfdcd5] bg-white focus-visible:ring-[#39796b]"
                />
              </label>
            </div>
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold text-[#425b51]">Reason <span className="font-normal text-[#819089]">· optional</span></span>
              <Textarea
                rows={3}
                maxLength={500}
                value={form.reason}
                onChange={(event) => updateField("reason", event.target.value)}
                placeholder="Brief context for change coordinators"
                className="resize-y border-[#cfdcd5] bg-white focus-visible:ring-[#39796b]"
              />
            </label>
            {form.startDate && form.endDate && form.endDate < form.startDate && (
              <p className="text-xs font-medium text-[#a34237]">End date must be on or after the start date.</p>
            )}
            {actionError && <p role="alert" className="rounded-md border border-[#e8c8c1] bg-[#fff3ef] px-3 py-2 text-xs text-[#8c453a]">{actionError}</p>}
            <DialogFooter className="gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={saveBlackout.isPending}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saveBlackout.isPending || !form.title.trim() || !form.startDate || !form.endDate || form.endDate < form.startDate}
                className="bg-[#245e53] text-white hover:bg-[#194b41]"
              >
                {saveBlackout.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editing ? "Save changes" : "Add blackout"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete blackout period?</AlertDialogTitle>
            <AlertDialogDescription>
              “{deleteTarget?.title}” will be removed from the calendar. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {actionError && <p role="alert" className="text-xs text-[#a34237]">{actionError}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setActionError("")}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteBlackout.isPending}
              onClick={(event) => {
                event.preventDefault();
                if (deleteTarget) deleteBlackout.mutate(deleteTarget);
              }}
              className="bg-[#a4473e] text-white hover:bg-[#89382f]"
            >
              {deleteBlackout.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              Delete blackout
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
