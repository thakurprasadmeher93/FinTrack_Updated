import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import {
  Check, Zap, TrendingUp, BarChart3, Lock, DollarSign,
  BookOpen, Handshake, Users, ArrowRight, Shield,
  PieChart, Target, Wallet, Receipt, Download,
  Building2, LineChart, ScanLine, Globe,
  ChevronRight, Sparkles, Award, Clock,
  Home as HomeIcon, ShoppingCart, Bus, Popcorn, Bolt, MoreHorizontal,
  TrendingDown, AlertTriangle, CheckCircle2, XCircle
} from "lucide-react";
import fintrackLogo from "@assets/FinTrack_Logo_Final_1781085987413.PNG";
import { useTheme } from "@/hooks/use-theme";
import { AppHeader } from "@/components/AppHeader";
import { AppFooter } from "@/components/AppFooter";

export default function Home() {
  const { colors, isDark } = useTheme();
  const goTo = (path: string) => { window.location.href = path; };

  const [income, setIncome] = useState("");
  const [expenses, setExpenses] = useState({
    rent: "",
    food: "",
    transport: "",
    entertainment: "",
    bills: "",
    others: ""
  });

  const inc = parseFloat(income) || 0;
  const exp = {
    rent:          parseFloat(expenses.rent) || 0,
    food:          parseFloat(expenses.food) || 0,
    transport:     parseFloat(expenses.transport) || 0,
    entertainment: parseFloat(expenses.entertainment) || 0,
    bills:         parseFloat(expenses.bills) || 0,
    others:        parseFloat(expenses.others) || 0,
  };
  const totalExp = Object.values(exp).reduce((a, b) => a + b, 0);
  const savings   = Math.max(0, inc - totalExp);
  const savingsRate = inc > 0 ? (savings / inc) * 100 : 0;
  const hasData   = inc > 0;

  const health =
    savingsRate >= 30 ? { label: "Excellent", color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-950/40", border: "border-emerald-200 dark:border-emerald-800", icon: CheckCircle2 } :
    savingsRate >= 20 ? { label: "Healthy",   color: "text-blue-500",    bg: "bg-blue-50 dark:bg-blue-950/40",       border: "border-blue-200 dark:border-blue-800",     icon: TrendingUp } :
    savingsRate >= 10 ? { label: "Needs Work", color: "text-amber-500",  bg: "bg-amber-50 dark:bg-amber-950/40",     border: "border-amber-200 dark:border-amber-800",   icon: AlertTriangle } :
                        { label: "Critical",  color: "text-red-500",     bg: "bg-red-50 dark:bg-red-950/40",         border: "border-red-200 dark:border-red-800",       icon: XCircle };

  const biggestCategory = (Object.entries(exp) as [string, number][])
    .sort((a, b) => b[1] - a[1])[0];

  const tip =
    !hasData ? "Enter your monthly income and expenses above to get a personalised tip." :
    totalExp > inc ? "⚠ You're spending more than you earn. Start by reviewing your biggest expense category." :
    savingsRate < 10 ? `Your savings rate is very low. Try reducing ${biggestCategory[0]} expenses to free up more rupees.` :
    savingsRate < 20 ? `Good start! Aim for 20% savings. Cutting back on ${biggestCategory[0]} could make a big difference.` :
    savingsRate < 30 ? "You're on track! Push for 30% savings and build a 6-month emergency fund." :
    "Outstanding! You're saving over 30% — consider investing the surplus in mutual funds or SIPs.";

  const expenseRows = [
    { key: "rent",          label: "Rent / Housing",     icon: HomeIcon,      color: "bg-violet-500" },
    { key: "food",          label: "Food & Groceries",   icon: ShoppingCart,  color: "bg-orange-500" },
    { key: "transport",     label: "Transport",          icon: Bus,           color: "bg-blue-500"   },
    { key: "entertainment", label: "Entertainment",      icon: Popcorn,       color: "bg-pink-500"   },
    { key: "bills",         label: "Bills & Utilities",  icon: Bolt,          color: "bg-amber-500"  },
    { key: "others",        label: "Others",             icon: MoreHorizontal,color: "bg-slate-400"  },
  ] as const;

  const features = [
    {
      icon: Receipt,
      title: "Smart Transaction Ledger",
      description: "Record every rupee with precision — income, expense, multi-category tagging, notes, and date. Search, filter, and audit your complete financial history at any time.",
      badge: "Core",
      color: "text-emerald-500",
      bg: "bg-emerald-50 dark:bg-emerald-950/40",
      topBar: "from-emerald-400 to-teal-400"
    },
    {
      icon: BarChart3,
      title: "Deep Analytics & Reports",
      description: "Visualise spending patterns through interactive donut charts, bar graphs, and trend lines. Drill into daily, monthly, and category-level breakdowns with export-ready reports.",
      badge: "Insights",
      color: "text-blue-500",
      bg: "bg-blue-50 dark:bg-blue-950/40",
      topBar: "from-blue-400 to-sky-400"
    },
    {
      icon: Target,
      title: "Budget Planning Engine",
      description: "Define monthly budgets per category, track burn-rate in real time, and receive alerts before you overshoot. Visual progress bars keep goals front and centre every day.",
      badge: "Planning",
      color: "text-violet-500",
      bg: "bg-violet-50 dark:bg-violet-950/40",
      topBar: "from-violet-400 to-purple-400"
    },
    {
      icon: Handshake,
      title: "Udhari Khata",
      description: "India's beloved khata system — digitised. Log money you gave or received from anyone, view running balances, and share a clean settlement summary over WhatsApp instantly.",
      badge: "Indian",
      color: "text-orange-500",
      bg: "bg-orange-50 dark:bg-orange-950/40",
      topBar: "from-orange-400 to-amber-400"
    },
    {
      icon: Users,
      title: "Group Bill Splitting",
      description: "Add participants, enter the total bill, and let FinTrack auto-calculate who owes whom. Perfect for trips, dinners, flatmates, or office pools — down to the last paisa.",
      badge: "Social",
      color: "text-pink-500",
      bg: "bg-pink-50 dark:bg-pink-950/40",
      topBar: "from-pink-400 to-rose-400"
    },
    {
      icon: Building2,
      title: "Property & Wealth Tracker",
      description: "Document immovable properties, vehicles, gold, and financial investments in one place. Track acquisition cost vs current value and monitor your net worth across time.",
      badge: "Wealth",
      color: "text-amber-500",
      bg: "bg-amber-50 dark:bg-amber-950/40",
      topBar: "from-amber-400 to-yellow-400"
    },
    {
      icon: PieChart,
      title: "Net Worth Snapshots",
      description: "Capture periodic wealth snapshots — assets, liabilities, investments — and chart your net worth trajectory. Know exactly where you stand financially at any point in life.",
      badge: "Wealth",
      color: "text-teal-500",
      bg: "bg-teal-50 dark:bg-teal-950/40",
      topBar: "from-teal-400 to-cyan-400"
    },
    {
      icon: Wallet,
      title: "Multi-Profile Accounts",
      description: "Switch between Personal, Family, and Business profiles within a single account. Each profile maintains its own transactions, budgets, and analytics — fully isolated and organised.",
      badge: "Flexible",
      color: "text-indigo-500",
      bg: "bg-indigo-50 dark:bg-indigo-950/40",
      topBar: "from-indigo-400 to-blue-400"
    },
    {
      icon: Shield,
      title: "Enterprise-Grade Security",
      description: "End-to-end encrypted sessions, hashed credentials, and strict server-side authentication. Your financial data never leaves our secure servers unprotected.",
      badge: "Security",
      color: "text-slate-500",
      bg: "bg-slate-50 dark:bg-slate-900/40",
      topBar: "from-slate-400 to-slate-500"
    }
  ];

  const stats = [
    { value: "₹0", label: "Hidden Fees", sub: "Free to explore" },
    { value: "9+", label: "Core Modules", sub: "All-in-one platform" },
    { value: "100%", label: "Data Control", sub: "Your data, your rules" },
    { value: "24/7", label: "Availability", sub: "Always accessible" }
  ];

  const pricingPlans = [
    {
      name: "Basic",
      price: "Free",
      description: "Perfect for getting started with personal finance",
      features: [
        "Up to 100 transactions/month",
        "Basic expense tracking",
        "Monthly summary view",
        "Single profile",
        "Standard analytics"
      ]
    },
    {
      name: "Pro",
      price: "₹99",
      period: "/month",
      description: "For individuals serious about financial mastery",
      popular: true,
      features: [
        "Unlimited transactions",
        "Advanced analytics & charts",
        "PDF & CSV exports",
        "Udhari Khata — debt tracking",
        "Group bill splitting",
        "Budget planning & alerts",
        "Wealth & property tracker",
        "Priority support"
      ]
    },
    {
      name: "Family",
      price: "₹199",
      period: "/month",
      description: "Complete financial management for the whole family",
      features: [
        "Everything in Pro",
        "Multiple family profiles",
        "Shared budget boards",
        "Consolidated family reports",
        "Role-based permissions",
        "Collaborative tracking"
      ]
    }
  ];

  const howItWorks = [
    {
      step: "01",
      title: "Create Your Account",
      desc: "Sign up in under a minute. No bank linking, no credit card, no complicated setup."
    },
    {
      step: "02",
      title: "Log Your Finances",
      desc: "Record income and expenses by category. Add budgets, debts, and asset details at your own pace."
    },
    {
      step: "03",
      title: "Analyse & Optimise",
      desc: "View real-time charts, spot trends, compare months, and make smarter money decisions every day."
    }
  ];


  return (
    <div className="min-h-screen bg-background flex flex-col">
      <AppHeader />

      <main className="flex-1">

        {/* ── Hero ── */}
        <section className="relative overflow-hidden py-20 md:py-32 bg-gradient-to-br from-emerald-950 via-slate-900 to-sky-950">
          {/* Decorative blobs — more vivid */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="absolute -top-32 -left-32 w-[700px] h-[700px] rounded-full bg-emerald-500/30 blur-[130px]" />
            <div className="absolute -bottom-32 -right-32 w-[600px] h-[600px] rounded-full bg-sky-500/25 blur-[130px]" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-teal-500/20 blur-[90px]" />
            <div className="absolute top-1/4 right-1/4 w-[250px] h-[250px] rounded-full bg-violet-500/15 blur-[70px]" />
          </div>

          {/* Grid overlay */}
          <div
            className="absolute inset-0 pointer-events-none opacity-[0.04]"
            style={{
              backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
              backgroundSize: "60px 60px"
            }}
          />

          <div className="relative max-w-5xl mx-auto px-4 md:px-8 text-center">
            <div className="mb-6 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/20 border border-primary/30 text-primary">
              <Sparkles className="w-4 h-4" />
              <span className="text-sm font-semibold tracking-wide uppercase">Free During Testing Phase</span>
            </div>

            <div className="mb-8 flex justify-center">
              <img src={fintrackLogo} alt="FinTrack Logo" className="h-28 md:h-36 w-auto drop-shadow-2xl" />
            </div>

            <h1 className="text-4xl md:text-6xl lg:text-7xl font-display font-bold text-white mb-4 leading-tight">
              Track Every Rupee
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">
                Under Your Control
              </span>
            </h1>

            <p className="text-base text-slate-400 mb-3 font-medium tracking-widest uppercase">
              A Product of Optimise Life · Powered by Simplicity
            </p>

            <p className="text-lg md:text-xl text-slate-300 mb-12 max-w-2xl mx-auto leading-relaxed">
              An enterprise-grade personal finance platform built for Indian households, students, freelancers, and families. From daily expenses to wealth tracking — all in one place.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
              <Button
                size="lg"
                className="h-14 text-base font-semibold px-10 bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/25"
                onClick={() => goTo("/login?mode=signup")}
                data-testid="button-get-started"
              >
                Get Started Free
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-14 text-base font-semibold px-10 border-white/20 text-white bg-white/5 hover:bg-white/10"
                onClick={() => goTo("/dashboard")}
                data-testid="button-try-demo"
              >
                <ScanLine className="w-5 h-5 mr-2" />
                Live Demo — No Login
              </Button>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto">
              {stats.map((s, i) => (
                <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-sm">
                  <div className="text-2xl md:text-3xl font-bold text-white font-display">{s.value}</div>
                  <div className="text-sm font-semibold text-primary mt-0.5">{s.label}</div>
                  <div className="text-xs text-slate-400 mt-0.5">{s.sub}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Beta Banner ── */}
        <section className="py-4 bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/10 border-b border-amber-200/40 dark:border-amber-800/30">
          <div className="max-w-7xl mx-auto px-4 md:px-8">
            <div className="flex items-center gap-3 justify-center text-center">
              <Zap className="w-4 h-4 text-amber-500 flex-shrink-0" />
              <p className="text-sm text-amber-800 dark:text-amber-300 font-medium">
                <strong>Open Testing Phase:</strong> All features are free to explore. Data may be reset before the final production launch. Enjoy the full platform at zero cost.
              </p>
            </div>
          </div>
        </section>

        {/* ── Features ── */}
        <section className="py-24 md:py-36 bg-gradient-to-b from-background via-emerald-50/40 to-background dark:via-emerald-950/10">
          <div className="max-w-7xl mx-auto px-4 md:px-8">
            <div className="text-center mb-16 md:mb-20">
              <Badge variant="outline" className="mb-4 px-4 py-1.5 text-sm font-semibold border-primary/30 text-primary bg-primary/5">
                Platform Capabilities
              </Badge>
              <h2 className="text-4xl md:text-5xl font-display font-bold text-foreground mb-5">
                Powerful Features for
                <span className="block text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 via-teal-500 to-sky-500">
                  Every Financial Need
                </span>
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                A complete financial operating system — purpose-built for the Indian context with enterprise-grade capabilities that scale from personal use to family and business.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {features.map((feature, idx) => {
                const Icon = feature.icon;
                return (
                  <Card
                    key={idx}
                    className="group relative p-7 border-border hover:border-primary/40 hover:shadow-xl hover:shadow-primary/8 transition-all duration-300 overflow-hidden"
                  >
                    {/* Coloured top bar — appears on hover */}
                    <div className={`absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r ${feature.topBar} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/0 to-primary/0 group-hover:from-primary/3 group-hover:to-accent/3 transition-all duration-300" />
                    <div className="relative">
                      <div className="flex items-start justify-between mb-5">
                        <div className={`w-12 h-12 rounded-xl ${feature.bg} flex items-center justify-center shadow-sm`}>
                          <Icon className={`w-6 h-6 ${feature.color}`} />
                        </div>
                        <Badge variant="outline" className="text-xs font-semibold border-border text-muted-foreground">
                          {feature.badge}
                        </Badge>
                      </div>
                      <h3 className="text-xl font-bold font-display text-foreground mb-3 group-hover:text-primary transition-colors">
                        {feature.title}
                      </h3>
                      <p className="text-muted-foreground text-sm leading-relaxed">
                        {feature.description}
                      </p>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── How It Works ── */}
        <section className="py-24 md:py-36 bg-gradient-to-b from-sky-50/60 via-background to-violet-50/40 dark:from-sky-950/15 dark:via-background dark:to-violet-950/10">
          <div className="max-w-7xl mx-auto px-4 md:px-8">
            <div className="text-center mb-16">
              <Badge variant="outline" className="mb-4 px-4 py-1.5 text-sm font-semibold border-primary/30 text-primary bg-primary/5">
                How It Works
              </Badge>
              <h2 className="text-4xl md:text-5xl font-display font-bold text-foreground mb-5">
                Up and Running in Minutes
              </h2>
              <p className="text-lg text-muted-foreground max-w-xl mx-auto">
                No complex onboarding. No bank integration required. Just you and your finances.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {[
                { ...howItWorks[0], stepColor: "text-emerald-500", bg: "bg-emerald-500/10", border: "border-emerald-500/25", hoverBg: "group-hover:bg-emerald-500/20", hoverBorder: "group-hover:border-emerald-500/50", connector: "border-emerald-300/40 dark:border-emerald-700/40" },
                { ...howItWorks[1], stepColor: "text-sky-500",     bg: "bg-sky-500/10",     border: "border-sky-500/25",     hoverBg: "group-hover:bg-sky-500/20",     hoverBorder: "group-hover:border-sky-500/50",     connector: "border-sky-300/40 dark:border-sky-700/40" },
                { ...howItWorks[2], stepColor: "text-violet-500",  bg: "bg-violet-500/10",  border: "border-violet-500/25",  hoverBg: "group-hover:bg-violet-500/20",  hoverBorder: "group-hover:border-violet-500/50",  connector: "" },
              ].map((step, i) => (
                <div key={i} className="relative text-center group">
                  {i < howItWorks.length - 1 && (
                    <div className={`hidden md:block absolute top-10 left-[60%] w-[80%] h-px border-t-2 border-dashed ${step.connector}`} />
                  )}
                  <div className={`relative inline-flex items-center justify-center w-20 h-20 rounded-2xl ${step.bg} border-2 ${step.border} mb-6 ${step.hoverBg} ${step.hoverBorder} transition-all shadow-sm`}>
                    <span className={`text-2xl font-display font-bold ${step.stepColor}`}>{step.step}</span>
                  </div>
                  <h3 className="text-xl font-bold font-display text-foreground mb-3">{step.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Module Highlight Band ── */}
        <section className="py-16 overflow-hidden bg-gradient-to-r from-emerald-950 via-slate-900 to-sky-950 border-y border-white/5 relative">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute left-0 top-0 w-[300px] h-full bg-emerald-500/10 blur-[80px]" />
            <div className="absolute right-0 top-0 w-[300px] h-full bg-sky-500/10 blur-[80px]" />
          </div>
          <div className="relative max-w-7xl mx-auto px-4 md:px-8">
            <div className="text-center mb-10">
              <h2 className="text-3xl md:text-4xl font-display font-bold text-white mb-3">
                One Platform. Nine Modules. Zero Compromises.
              </h2>
              <p className="text-slate-400">Every feature your financial life demands — built in.</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-9 gap-3">
              {[
                { icon: Receipt,   label: "Transactions",  color: "text-emerald-400", ring: "hover:border-emerald-500/40 hover:bg-emerald-500/10" },
                { icon: BarChart3, label: "Analytics",     color: "text-sky-400",     ring: "hover:border-sky-500/40 hover:bg-sky-500/10" },
                { icon: Target,    label: "Budgets",       color: "text-violet-400",  ring: "hover:border-violet-500/40 hover:bg-violet-500/10" },
                { icon: Handshake, label: "Udhari Khata",  color: "text-orange-400",  ring: "hover:border-orange-500/40 hover:bg-orange-500/10" },
                { icon: Users,     label: "Bill Split",    color: "text-pink-400",    ring: "hover:border-pink-500/40 hover:bg-pink-500/10" },
                { icon: Building2, label: "Properties",    color: "text-amber-400",   ring: "hover:border-amber-500/40 hover:bg-amber-500/10" },
                { icon: LineChart, label: "Net Worth",     color: "text-teal-400",    ring: "hover:border-teal-500/40 hover:bg-teal-500/10" },
                { icon: Wallet,    label: "Profiles",      color: "text-indigo-400",  ring: "hover:border-indigo-500/40 hover:bg-indigo-500/10" },
                { icon: Shield,    label: "Security",      color: "text-slate-300",   ring: "hover:border-slate-400/40 hover:bg-slate-500/10" },
              ].map(({ icon: Icon, label, color, ring }, i) => (
                <div key={i} className={`flex flex-col items-center gap-2 p-3 rounded-xl bg-white/5 border border-white/10 ${ring} transition-all cursor-default`}>
                  <Icon className={`w-5 h-5 ${color}`} />
                  <span className="text-xs text-slate-300 font-medium text-center leading-tight">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Budget Health Calculator ── */}
        <section className="py-24 md:py-36 bg-gradient-to-b from-background via-amber-50/30 to-background dark:via-amber-950/8">
          <div className="max-w-5xl mx-auto px-4 md:px-8">
            <div className="text-center mb-12">
              <Badge variant="outline" className="mb-4 px-4 py-1.5 text-sm font-semibold border-primary/30 text-primary bg-primary/5">
                Try It Now — Free
              </Badge>
              <h2 className="text-4xl md:text-5xl font-display font-bold text-foreground mb-5">
                Budget Health
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent"> Calculator</span>
              </h2>
              <p className="text-lg text-muted-foreground max-w-xl mx-auto">
                Enter your monthly numbers and get an instant financial health score with a personalised tip — no sign-up needed.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8 items-start">
              {/* ── Input panel ── */}
              <Card className="p-7 border-border">
                <h3 className="text-base font-bold text-foreground mb-5 flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-primary" />
                  Monthly Numbers (₹)
                </h3>

                {/* Income */}
                <div className="mb-6">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
                    Monthly Income / Take-Home Salary
                  </label>
                  <Input
                    type="number"
                    placeholder="e.g. 50000"
                    value={income}
                    onChange={e => setIncome(e.target.value)}
                    className="text-base font-semibold"
                    data-testid="input-calculator-income"
                  />
                </div>

                <div className="h-px bg-border mb-5" />

                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Monthly Expenses</p>

                <div className="space-y-3">
                  {expenseRows.map(({ key, label, icon: Icon }) => (
                    <div key={key} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                        <Icon className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <label className="text-sm text-foreground w-36 flex-shrink-0">{label}</label>
                      <Input
                        type="number"
                        placeholder="0"
                        value={expenses[key]}
                        onChange={e => setExpenses(prev => ({ ...prev, [key]: e.target.value }))}
                        className="text-sm"
                        data-testid={`input-calculator-${key}`}
                      />
                    </div>
                  ))}
                </div>
              </Card>

              {/* ── Results panel ── */}
              <div className="space-y-5">
                {/* Score card */}
                <Card className={`p-6 border-2 ${health.border} ${health.bg}`}>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm font-semibold text-muted-foreground">Financial Health Score</span>
                    <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/60 dark:bg-black/20 border ${health.border}`}>
                      {(() => { const HIcon = health.icon; return <HIcon className={`w-4 h-4 ${health.color}`} />; })()}
                      <span className={`text-sm font-bold ${health.color}`}>{health.label}</span>
                    </div>
                  </div>

                  {/* Savings rate dial */}
                  <div className="mb-4">
                    <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                      <span>Savings Rate</span>
                      <span className={`font-bold text-sm ${health.color}`}>
                        {hasData ? `${savingsRate.toFixed(1)}%` : "—"}
                      </span>
                    </div>
                    <div className="h-3 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          savingsRate >= 30 ? "bg-emerald-500" :
                          savingsRate >= 20 ? "bg-blue-500" :
                          savingsRate >= 10 ? "bg-amber-500" : "bg-red-500"
                        }`}
                        style={{ width: `${Math.min(100, hasData ? savingsRate : 0)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                      <span>0%</span><span>10%</span><span>20%</span><span>30%+</span>
                    </div>
                  </div>

                  {/* 3 summary metrics */}
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: "Income",   value: hasData ? `₹${inc.toLocaleString("en-IN")}` : "—", sub: "per month" },
                      { label: "Expenses", value: hasData ? `₹${totalExp.toLocaleString("en-IN")}` : "—", sub: totalExp > inc ? "⚠ Over budget" : "per month" },
                      { label: "Savings",  value: hasData ? `₹${savings.toLocaleString("en-IN")}` : "—", sub: "per month" },
                    ].map(m => (
                      <div key={m.label} className="bg-white/50 dark:bg-black/20 rounded-xl p-3 text-center">
                        <div className="text-[11px] text-muted-foreground mb-0.5">{m.label}</div>
                        <div className="text-sm font-bold text-foreground leading-tight">{m.value}</div>
                        <div className={`text-[10px] mt-0.5 ${m.sub.includes("⚠") ? "text-red-500 font-semibold" : "text-muted-foreground"}`}>{m.sub}</div>
                      </div>
                    ))}
                  </div>
                </Card>

                {/* Spending breakdown bars */}
                {hasData && totalExp > 0 && (
                  <Card className="p-6 border-border">
                    <h4 className="text-sm font-bold text-foreground mb-4">Spending Breakdown</h4>
                    <div className="space-y-3">
                      {expenseRows
                        .filter(r => exp[r.key] > 0)
                        .sort((a, b) => exp[b.key] - exp[a.key])
                        .map(({ key, label, color }) => {
                          const pct = inc > 0 ? (exp[key] / inc) * 100 : 0;
                          return (
                            <div key={key}>
                              <div className="flex justify-between text-xs mb-1">
                                <span className="text-muted-foreground">{label}</span>
                                <span className="font-semibold text-foreground">
                                  {pct.toFixed(1)}% &nbsp;
                                  <span className="font-normal text-muted-foreground">₹{exp[key].toLocaleString("en-IN")}</span>
                                </span>
                              </div>
                              <div className="h-2 bg-muted rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${color} transition-all duration-500`}
                                  style={{ width: `${Math.min(100, pct)}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </Card>
                )}

                {/* Tip */}
                <Card className="p-5 border-border bg-muted/30">
                  <p className="text-xs font-bold text-primary uppercase tracking-wider mb-2">FinTrack Tip</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{tip}</p>
                </Card>

                <Button
                  className="w-full h-12 text-base font-semibold bg-primary hover:bg-primary/90 text-primary-foreground"
                  onClick={() => goTo("/login?mode=signup")}
                  data-testid="button-calculator-signup"
                >
                  Track This Properly in FinTrack
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* ── Pricing ── */}
        <section className="py-24 md:py-36 bg-gradient-to-b from-emerald-50/50 via-background to-sky-50/40 dark:from-emerald-950/15 dark:via-background dark:to-sky-950/10">
          <div className="max-w-7xl mx-auto px-4 md:px-8">
            <div className="text-center mb-16">
              <Badge variant="outline" className="mb-4 px-4 py-1.5 text-sm font-semibold border-primary/30 text-primary bg-primary/5">
                Pricing
              </Badge>
              <h2 className="text-4xl md:text-5xl font-display font-bold text-foreground mb-5">
                Simple, Transparent Pricing
              </h2>
              <p className="text-lg text-muted-foreground max-w-xl mx-auto">
                No hidden charges. No surprise upgrades. Choose a plan that fits your life.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8 items-start">
              {pricingPlans.map((plan, idx) => (
                <Card
                  key={idx}
                  className={`relative p-8 flex flex-col h-full transition-all duration-300 ${
                    plan.popular
                      ? "border-primary shadow-2xl shadow-primary/15 ring-2 ring-primary/30 md:scale-105 bg-gradient-to-b from-primary/5 to-transparent"
                      : "border-border hover:border-primary/30 hover:shadow-lg"
                  }`}
                >
                  {plan.popular && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                      <div className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-primary text-primary-foreground text-sm font-bold shadow-lg">
                        <Award className="w-3.5 h-3.5" />
                        Most Popular
                      </div>
                    </div>
                  )}

                  <div className="mb-6 pt-2">
                    <h3 className="text-2xl font-bold font-display text-foreground mb-1">{plan.name}</h3>
                    <p className="text-muted-foreground text-sm">{plan.description}</p>
                  </div>

                  <div className="mb-7">
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl md:text-5xl font-bold font-display text-foreground">{plan.price}</span>
                      {plan.period && (
                        <span className="text-muted-foreground text-lg">{plan.period}</span>
                      )}
                    </div>
                    {!plan.period && <span className="text-sm text-muted-foreground">Forever free</span>}
                  </div>

                  <Button
                    className={`w-full mb-7 h-12 text-base font-semibold ${
                      plan.popular ? "bg-primary hover:bg-primary/90 text-primary-foreground shadow-md" : ""
                    }`}
                    variant={plan.popular ? "default" : "outline"}
                    onClick={() => goTo("/login?mode=signup")}
                    data-testid={`button-pricing-${plan.name.toLowerCase()}`}
                  >
                    Get Started
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>

                  <div className="space-y-3 flex-1">
                    {plan.features.map((feature, fidx) => (
                      <div key={fidx} className="flex items-start gap-3">
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                          plan.popular ? "bg-primary/15" : "bg-emerald-50 dark:bg-emerald-950/40"
                        }`}>
                          <Check className={`w-3 h-3 ${plan.popular ? "text-primary" : "text-emerald-500"}`} />
                        </div>
                        <span className="text-sm text-foreground">{feature}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              ))}
            </div>

            <p className="text-center text-muted-foreground text-sm mt-12 flex items-center justify-center gap-2">
              <Clock className="w-4 h-4" />
              All plans include a 14-day free trial. No credit card required.
            </p>
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="py-24 md:py-36 relative overflow-hidden bg-gradient-to-br from-emerald-950 via-slate-900 to-sky-950">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-emerald-500/25 rounded-full blur-[110px]" />
            <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-sky-500/20 rounded-full blur-[110px]" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-teal-500/15 rounded-full blur-[80px]" />
          </div>

          <div className="relative max-w-4xl mx-auto px-4 md:px-8 text-center">
            <div className="mb-6 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/20 border border-primary/30 text-primary">
              <Globe className="w-4 h-4" />
              <span className="text-sm font-semibold">Join the FinTrack Community</span>
            </div>

            <h2 className="text-4xl md:text-6xl font-display font-bold text-white mb-6 leading-tight">
              Your Financial Future
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">
                Starts Today
              </span>
            </h2>
            <p className="text-lg md:text-xl text-slate-300 mb-12 max-w-2xl mx-auto">
              Stop guessing where your money goes. Start making every rupee work for you with India's most thoughtful personal finance platform.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                size="lg"
                className="h-14 text-base font-semibold px-10 bg-primary hover:bg-primary/90 text-primary-foreground shadow-xl shadow-primary/30"
                onClick={() => goTo("/login?mode=signup")}
                data-testid="button-free-trial"
              >
                Start for Free
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
              <Button
                size="lg"
                variant="ghost"
                className="h-14 text-base font-semibold px-10 text-white hover:bg-white/10 border border-white/20"
                onClick={() => goTo("/dashboard")}
                data-testid="button-explore-demo"
              >
                Explore Live Demo
              </Button>
            </div>
          </div>
        </section>

      </main>

      <AppFooter />
    </div>
  );
}
