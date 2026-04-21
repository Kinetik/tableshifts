"use client";

import * as React from "react";
import {
  BarChart3,
  Building2,
  CalendarDays,
  ChevronDown,
  ClipboardCheck,
  Download,
  FileText,
  LayoutDashboard,
  Settings2,
  ShieldCheck,
  Sparkles,
  UsersRound
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

const days = Array.from({ length: 31 }, (_, index) => index + 1);
const people = [
  { name: "Ana Dobre", position: "Team Leader", worked: 168, norm: 176, diff: -8, co: 2, status: "steady" },
  { name: "Irina Nita", position: "Production Operator", worked: 184, norm: 176, diff: 8, co: 0, status: "overtime" },
  { name: "Mara Pop", position: "Payroll Specialist", worked: 160, norm: 160, diff: 0, co: 1, status: "balanced" },
  { name: "Alex Matei", position: "Support Engineer", worked: 152, norm: 176, diff: -24, co: 3, status: "leave" }
];

const nav = [
  { label: "Timesheet", icon: LayoutDashboard },
  { label: "Leave Requests", icon: ClipboardCheck },
  { label: "Charts", icon: BarChart3 },
  { label: "Companies", icon: Building2 },
  { label: "Employees", icon: UsersRound },
  { label: "Admins", icon: ShieldCheck },
  { label: "Settings", icon: Settings2 }
];

function dayCode(personIndex: number, day: number) {
  if ([4, 5, 11, 12, 18, 19, 25, 26].includes(day)) return { label: "", className: "bg-sky-50" };
  if (personIndex === 0 && [13, 14].includes(day)) return { label: "CO", className: "bg-emerald-100 text-emerald-800" };
  if (personIndex === 1 && day === 10) return { label: "OT", detail: "8h+2h", className: "bg-amber-100 text-amber-900" };
  if (personIndex === 2 && day === 20) return { label: "SE", className: "bg-stone-200 text-stone-700" };
  if (personIndex === 3 && day === 16) return { label: "CM", className: "bg-rose-100 text-rose-800" };
  return { label: "N", detail: "8h", className: "bg-white" };
}

export function TableShiftsRedesign() {
  const [activeTab, setActiveTab] = React.useState("timesheet");

  return (
    <main className="min-h-screen p-4 text-stone-950 md:p-6">
      <div className="grid min-h-[calc(100vh-48px)] grid-cols-1 gap-4 lg:grid-cols-[260px_1fr]">
        <aside className="rounded-lg border border-emerald-900/10 bg-emerald-950 p-4 text-white shadow-xl shadow-emerald-950/10">
          <div className="flex items-center gap-3 border-b border-white/10 pb-5">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-white text-sm font-black text-emerald-900">
              TS
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-200">Tableshifts</p>
              <p className="text-sm text-emerald-50">Development UI</p>
            </div>
          </div>

          <nav className="mt-5 grid gap-1">
            {nav.map((item) => (
              <button
                key={item.label}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm font-semibold text-emerald-50/80 transition-colors hover:bg-white/10 hover:text-white",
                  activeTab === item.label.toLowerCase().replace(" ", "-") && "bg-white text-emerald-950 hover:bg-white"
                )}
                onClick={() => setActiveTab(item.label.toLowerCase().replace(" ", "-"))}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </button>
            ))}
          </nav>
        </aside>

        <section className="overflow-hidden rounded-lg border border-stone-200 bg-white/72 shadow-xl shadow-stone-950/5 backdrop-blur">
          <header className="flex flex-col gap-4 border-b border-stone-200 bg-white p-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <Badge variant="success">Development branch</Badge>
                <Badge variant="outline">Next.js + shadcn</Badge>
              </div>
              <h1 className="text-3xl font-black tracking-normal text-stone-950 md:text-4xl">Timesheet</h1>
              <button className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-stone-600">
                Nova Operations <ChevronDown className="h-4 w-4" />
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline">
                <CalendarDays className="h-4 w-4" />
                April 2026
              </Button>
              <Button variant="outline">
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
              <Button>
                <Sparkles className="h-4 w-4" />
                Save changes
              </Button>
            </div>
          </header>

          <div className="p-5">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="mb-5">
                <TabsTrigger value="timesheet">Timesheet</TabsTrigger>
                <TabsTrigger value="leave-requests">Leave</TabsTrigger>
                <TabsTrigger value="charts">Charts</TabsTrigger>
                <TabsTrigger value="companies">Management</TabsTrigger>
              </TabsList>

              <TabsContent value="timesheet">
                <div className="mb-4 grid gap-3 md:grid-cols-4">
                  {[
                    ["People", "24", "visible scope"],
                    ["Worked", "3,944h", "month total"],
                    ["Overtime", "42h", "approved and recorded"],
                    ["CO left", "218d", "available vacation"]
                  ].map(([label, value, hint]) => (
                    <Card key={label}>
                      <CardHeader className="p-4">
                        <CardDescription className="font-bold uppercase tracking-wide">{label}</CardDescription>
                        <CardTitle className="text-2xl">{value}</CardTitle>
                        <p className="text-xs text-stone-500">{hint}</p>
                      </CardHeader>
                    </Card>
                  ))}
                </div>

                <Card className="overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[1180px] border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-stone-200 bg-stone-50">
                          <th className="sticky left-0 z-10 w-56 bg-stone-50 px-4 py-3 text-left font-black">Employee</th>
                          {days.map((day) => (
                            <th key={day} className="w-11 border-l border-stone-200 px-1 py-2 text-center">
                              <span className="block text-base font-black">{day}</span>
                              <span className="text-[11px] font-bold text-stone-500">Wed</span>
                            </th>
                          ))}
                          {["Worked", "Norm", "Diff", "OT", "CO", "CM", "SE"].map((label) => (
                            <th key={label} className="border-l border-stone-200 px-3 py-3 text-center font-black">
                              {label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {people.map((person, personIndex) => (
                          <tr key={person.name} className="border-b border-stone-200 hover:bg-stone-50/60">
                            <td className="sticky left-0 z-10 bg-white px-4 py-3">
                              <strong className="block text-base">{person.name}</strong>
                              <span className="text-xs font-semibold text-stone-500">{person.position}</span>
                            </td>
                            {days.map((day) => {
                              const code = dayCode(personIndex, day);
                              return (
                                <td key={day} className={cn("border-l border-stone-200 px-1 py-2 text-center", code.className)}>
                                  <span className="block font-black">{code.label}</span>
                                  <span className="text-xs text-stone-500">{code.detail}</span>
                                </td>
                              );
                            })}
                            <td className="border-l border-stone-200 px-3 text-center font-black">{person.worked}h</td>
                            <td className="border-l border-stone-200 px-3 text-center font-black">{person.norm}h</td>
                            <td className={cn("border-l border-stone-200 px-3 text-center font-black", person.diff < 0 ? "text-rose-700" : "text-emerald-700")}>
                              {person.diff > 0 ? "+" : ""}
                              {person.diff}h
                            </td>
                            <td className="border-l border-stone-200 px-3 text-center font-black">{person.status === "overtime" ? "2h" : "0h"}</td>
                            <td className="border-l border-stone-200 px-3 text-center font-black">{person.co}d</td>
                            <td className="border-l border-stone-200 px-3 text-center font-black">{person.status === "leave" ? "1d" : "0d"}</td>
                            <td className="border-l border-stone-200 px-3 text-center font-black">{person.status === "balanced" ? "1d" : "0d"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </TabsContent>

              <TabsContent value="leave-requests">
                <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
                  <Card>
                    <CardHeader>
                      <CardTitle>Pending approvals</CardTitle>
                      <CardDescription>One line per request, with document actions nearby.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-3">
                      {["Ana Dobre requested CO from Apr 22 to Apr 24", "Irina Nita attached CM document for Apr 17"].map((request) => (
                        <div key={request} className="flex items-center justify-between rounded-lg border border-stone-200 p-3">
                          <span className="font-semibold">{request}</span>
                          <Button size="sm" variant="outline">
                            Review
                          </Button>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle>Document preview</CardTitle>
                      <CardDescription>Generated leave forms stay attached to the request.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="rounded-lg border border-dashed border-stone-300 p-6 text-center">
                        <FileText className="mx-auto mb-3 h-10 w-10 text-emerald-700" />
                        <p className="text-sm font-semibold">Requested status preview</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="charts">
                <div className="grid gap-4 md:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle>Scope fulfilment</CardTitle>
                      <CardDescription>Worked hours against monthly norm.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="h-3 rounded-full bg-stone-100">
                        <div className="h-3 w-[86%] rounded-full bg-emerald-700" />
                      </div>
                      <p className="mt-3 text-sm font-semibold">86% completed</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle>Leave mix</CardTitle>
                      <CardDescription>CO, CM and special event balance.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-2">
                      {[
                        ["CO", "bg-emerald-500", "42%"],
                        ["CM", "bg-rose-400", "18%"],
                        ["SE", "bg-stone-400", "9%"]
                      ].map(([label, color, width]) => (
                        <div key={label} className="grid grid-cols-[40px_1fr_44px] items-center gap-3 text-sm font-semibold">
                          <span>{label}</span>
                          <div className="h-2 rounded-full bg-stone-100">
                            <div className={cn("h-2 rounded-full", color)} style={{ width }} />
                          </div>
                          <span>{width}</span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="companies">
                <Card>
                  <CardHeader>
                    <CardTitle>Management workspace</CardTitle>
                    <CardDescription>Companies, departments, admins and employees will be ported into this hierarchy next.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-3 md:grid-cols-3">
                    {["Companies", "Departments", "People"].map((label) => (
                      <div key={label} className="rounded-lg border border-stone-200 p-4">
                        <p className="font-black">{label}</p>
                        <p className="mt-1 text-sm text-stone-500">Expandable setup panel</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </section>
      </div>
    </main>
  );
}
