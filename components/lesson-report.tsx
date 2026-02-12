"use client"

import { motion } from "framer-motion"
import { useHelpFlow } from "@/lib/helpflow-context"
import {
  ArrowLeft,
  Users,
  Hand,
  Clock,
  UserCheck,
  UserX,
  Download,
} from "lucide-react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"

const spring = { type: "spring", stiffness: 300, damping: 24 } as const

const CHART_COLORS = ["#2D9389", "#115D7F", "#AD4225", "#F9B940", "#3AAFA9"]

export function LessonReport() {
  const { lessonReport, setScreen, startLesson, studentRoster, everConnectedIds } = useHelpFlow()

  if (!lessonReport) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <div className="w-16 h-16 rounded-full border-4 border-[#2D9389]/20 border-t-[#2D9389] animate-spin mb-4" />
        <h2 className="text-xl font-bold text-foreground">Preparing Report...</h2>
        <p className="text-muted-foreground mt-2">Gathering lesson data</p>
      </div>
    )
  }

  const chartData = Object.entries(lessonReport.requestsByStudent).map(
    ([name, count]) => ({
      name: name.split(" ")[0],
      fullName: name,
      requests: count,
    })
  )

  const lessonDuration = Math.round(
    (lessonReport.endedAt - lessonReport.startedAt) / 60000
  )
  const avgWaitFormatted =
    lessonReport.averageWaitTime > 0
      ? `${Math.round(lessonReport.averageWaitTime / 1000)}s`
      : "N/A"

  function handleNewLesson() {
    startLesson()
    setScreen("teacher")
  }


  function handleExportPDF() {
    if (!lessonReport) return

    const doc = new jsPDF()

    // Title
    doc.setFontSize(20)
    doc.setTextColor(45, 147, 137) // #2D9389
    doc.text("HelpFlow Lesson Report", 14, 22)

    // Subtitle / Date
    doc.setFontSize(11)
    doc.setTextColor(100)
    doc.text(`Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`, 14, 30)

    // Summary Stats
    doc.setFillColor(245, 247, 250)
    doc.roundedRect(14, 38, 182, 28, 3, 3, "F")

    doc.setFontSize(10)
    doc.setTextColor(80)
    doc.text("Total Requests", 20, 48)
    doc.text("Avg Wait Time", 70, 48)
    doc.text("Students Engaged", 120, 48)
    doc.text("Not Engaged", 170, 48)

    doc.setFontSize(14)
    doc.setTextColor(40)
    doc.setFont("helvetica", "bold")
    doc.text(lessonReport.totalRequests.toString(), 20, 56)
    doc.text(avgWaitFormatted, 70, 56)
    doc.text(lessonReport.studentsHelped.length.toString(), 120, 56)
    doc.text(lessonReport.studentsNotEngaged.length.toString(), 170, 56)

    // Request Table
    doc.setFont("helvetica", "normal")
    doc.setFontSize(14)
    doc.setTextColor(45, 147, 137)
    doc.text("Student Request Details", 14, 80)

    const tableData = Object.entries(lessonReport.requestsByStudent).map(([name, count]) => [name, count])

    autoTable(doc, {
      startY: 85,
      head: [["Student Name", "Help Requests"]],
      body: tableData,
      theme: "striped",
      headStyles: { fillColor: [45, 147, 137] },
      styles: { fontSize: 10, cellPadding: 4 },
    })

    // Engagement Lists
    const finalY = (doc as any).lastAutoTable.finalY + 15

    doc.setFontSize(14)
    doc.setTextColor(45, 147, 137)
    doc.text("Engagement Summary", 14, finalY)

    doc.setFontSize(10)
    doc.setTextColor(0)
    doc.text("Engaged Students:", 14, finalY + 10)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(80)
    const engagedText = lessonReport.studentsHelped.length > 0 ? lessonReport.studentsHelped.join(", ") : "None"
    const engagedLines = doc.splitTextToSize(engagedText, 180)
    doc.text(engagedLines, 14, finalY + 16)

    const notEngagedY = finalY + 16 + (engagedLines.length * 5) + 5
    doc.setFont("helvetica", "bold")
    doc.setTextColor(0)
    doc.text("Not Engaged:", 14, notEngagedY)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(80)
    const notEngagedText = lessonReport.studentsNotEngaged.length > 0 ? lessonReport.studentsNotEngaged.join(", ") : "None"
    const notEngagedLines = doc.splitTextToSize(notEngagedText, 180)
    doc.text(notEngagedLines, 14, notEngagedY + 6)

    doc.save(`helpflow-report-${new Date().toISOString().slice(0, 10)}.pdf`)
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-[#F9B940]/5">
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={spring}
        className="sticky top-0 z-20 bg-card/80 backdrop-blur-xl border-b border-border"
      >
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setScreen("teacher")}
              className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="Go back"
            >
              <ArrowLeft className="w-5 h-5" />
            </motion.button>
            <h1 className="text-lg font-bold text-card-foreground">
              Lesson Report
            </h1>
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleExportPDF}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-muted text-foreground text-sm font-medium hover:bg-muted/80 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export PDF
          </motion.button>
        </div>
      </motion.header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* Summary cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...spring, delay: 0.05 }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8"
        >
          {[
            {
              label: "Total Requests",
              value: lessonReport.totalRequests.toString(),
              icon: Hand,
              color: "#2D9389",
              bg: "from-[#2D9389]/10 to-[#2D9389]/5",
            },
            {
              label: "Avg Wait Time",
              value: avgWaitFormatted,
              icon: Clock,
              color: "#115D7F",
              bg: "from-[#115D7F]/10 to-[#115D7F]/5",
            },
            {
              label: "Students Engaged",
              value: lessonReport.studentsHelped.length.toString(),
              icon: UserCheck,
              color: "#F9B940",
              bg: "from-[#F9B940]/10 to-[#F9B940]/5",
            },
            {
              label: "Not Engaged",
              value: lessonReport.studentsNotEngaged.length.toString(),
              icon: UserX,
              color: "#AD4225",
              bg: "from-[#AD4225]/10 to-[#AD4225]/5",
            },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...spring, delay: 0.1 + i * 0.05 }}
              className={`bg-gradient-to-br ${stat.bg} rounded-2xl border border-border p-5`}
            >
              <stat.icon
                className="w-6 h-6 mb-3"
                style={{ color: stat.color }}
              />
              <p
                className="text-3xl font-bold"
                style={{ color: stat.color }}
              >
                {stat.value}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {stat.label}
              </p>
            </motion.div>
          ))}
        </motion.div>

        {/* Lesson info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...spring, delay: 0.15 }}
          className="bg-card rounded-2xl border border-border p-5 mb-8 flex items-center justify-between"
        >
          <div>
            <p className="text-sm text-muted-foreground">Lesson Duration</p>
            <p className="text-lg font-bold text-card-foreground">
              {lessonDuration} minutes
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Class Size</p>
            <p className="text-lg font-bold text-card-foreground">
              {lessonReport.totalConnectedStudents ?? (everConnectedIds.size > 0 ? everConnectedIds.size : studentRoster.length)} students
            </p>
          </div>
        </motion.div>

        {/* Request frequency chart */}
        {chartData.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring, delay: 0.2 }}
            className="bg-card rounded-2xl border border-border p-6 mb-8"
          >
            <h3 className="text-lg font-bold text-card-foreground mb-1">
              Request Frequency
            </h3>
            <p className="text-sm text-muted-foreground mb-6">
              Number of help requests per student
            </p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} barCategoryGap="20%">
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(var(--border))"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="fullName"
                    tickFormatter={(val) => val.split(" ")[0]}
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: 'hsl(var(--muted)/0.4)' }}
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "12px",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                    }}
                    labelStyle={{ color: "hsl(var(--card-foreground))" }}
                    formatter={(value: number) => [`${value} requests`, "Requests"]}
                  />
                  <Bar dataKey="requests" radius={[8, 8, 0, 0]}>
                    {chartData.map((_entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={CHART_COLORS[index % CHART_COLORS.length]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        )}

        {/* Student engagement lists */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
          {/* Engaged students */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring, delay: 0.25 }}
            className="bg-card rounded-2xl border border-border p-5"
          >
            <div className="flex items-center gap-2 mb-4">
              <UserCheck className="w-5 h-5 text-[#2D9389]" />
              <h3 className="font-semibold text-card-foreground">
                Engaged Students
              </h3>
              <span className="text-xs px-2 py-0.5 rounded-full bg-[#2D9389]/10 text-[#2D9389] font-medium">
                {lessonReport.studentsHelped.length}
              </span>
            </div>
            <div className="flex flex-col gap-2">
              {lessonReport.studentsHelped.map((name, i) => (
                <motion.div
                  key={name}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ ...spring, delay: 0.3 + i * 0.03 }}
                  className="flex items-center gap-3 px-3 py-2 rounded-xl bg-[#2D9389]/5"
                >
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#2D9389] to-[#115D7F] flex items-center justify-center">
                    <span className="text-white text-xs font-bold">
                      {name.charAt(0)}
                    </span>
                  </div>
                  <span className="text-sm font-medium text-card-foreground">
                    {name}
                  </span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {lessonReport.requestsByStudent[name] || 0} req
                  </span>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Not engaged students */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring, delay: 0.3 }}
            className="bg-card rounded-2xl border border-border p-5"
          >
            <div className="flex items-center gap-2 mb-4">
              <UserX className="w-5 h-5 text-[#AD4225]" />
              <h3 className="font-semibold text-card-foreground">
                Not Engaged
              </h3>
              <span className="text-xs px-2 py-0.5 rounded-full bg-[#AD4225]/10 text-[#AD4225] font-medium">
                {lessonReport.studentsNotEngaged.length}
              </span>
            </div>
            <div className="flex flex-col gap-2">
              {lessonReport.studentsNotEngaged.length === 0 ? (
                <div className="text-center py-6">
                  <Users className="w-8 h-8 text-[#2D9389] mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    All students were engaged!
                  </p>
                </div>
              ) : (
                lessonReport.studentsNotEngaged.map((name, i) => (
                  <motion.div
                    key={name}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ ...spring, delay: 0.35 + i * 0.03 }}
                    className="flex items-center gap-3 px-3 py-2 rounded-xl bg-[#AD4225]/5"
                  >
                    <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center">
                      <span className="text-muted-foreground text-xs font-bold">
                        {name.charAt(0)}
                      </span>
                    </div>
                    <span className="text-sm font-medium text-card-foreground">
                      {name}
                    </span>
                  </motion.div>
                ))
              )}
            </div>
          </motion.div>
        </div>

        {/* New lesson button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...spring, delay: 0.35 }}
          className="text-center"
        >
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={handleNewLesson}
            className="px-8 py-3 rounded-xl bg-gradient-to-r from-[#2D9389] to-[#115D7F] text-white font-semibold shadow-lg shadow-[#2D9389]/20 text-base"
          >
            Start New Lesson
          </motion.button>
        </motion.div>
      </main>
    </div>
  )
}
