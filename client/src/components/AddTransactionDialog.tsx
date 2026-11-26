import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateTransaction, useCategories, useCreateCategory, useCreateDebt } from "@/hooks/use-fin-track";
import { Plus, Loader2, User, Phone, MessageSquare, Trash2, Calendar } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";

interface AddTransactionDialogProps {
  profileId: number;
}

export function AddTransactionDialog({ profileId }: AddTransactionDialogProps) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("transaction");
  const { toast } = useToast();

  // Transaction State
  const [type, setType] = useState<"expense" | "income">("expense");
  const [categoryId, setCategoryId] = useState<string>("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [time, setTime] = useState(format(new Date(), "HH:mm"));
  const [note, setNote] = useState("");
  const [customCategory, setCustomCategory] = useState("");

  // Debt State
  const [debtType, setDebtType] = useState<"gave" | "got">("gave");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [debtAmount, setDebtAmount] = useState("");
  const [debtNote, setDebtNote] = useState("");
  const [debtDate, setDebtDate] = useState(format(new Date(), "yyyy-MM-dd"));

  // Split Bill State
  const [splitDescription, setSplitDescription] = useState("");
  const [splitDate, setSplitDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [participants, setParticipants] = useState<Array<{ name: string; phone: string; amount: string }>>([]);
  const [tempParticipantName, setTempParticipantName] = useState("");
  const [tempParticipantPhone, setTempParticipantPhone] = useState("");
  const [tempParticipantAmount, setTempParticipantAmount] = useState("");
  const [isSplitPending, setIsSplitPending] = useState(false);

  const { data: categories } = useCategories(profileId);
  const { mutate: createTransaction, isPending: isTxPending } = useCreateTransaction();
  const { mutate: createDebt, isPending: isDebtPending } = useCreateDebt();

  const filteredCategories = categories?.filter(c => c.type === type) || [];

  const handleTxSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !date || !categoryId) return;

    let finalCategoryId = parseInt(categoryId);
    const selectedCategory = categories?.find(c => c.id === finalCategoryId);

    const [year, month, day] = date.split("-").map(Number);
    const [hours, minutes] = time.split(":").map(Number);
    const transactionDate = new Date(year, month - 1, day, hours, minutes);

    createTransaction({
      profileId,
      amount: type === "expense" ? `-${Math.abs(Number(amount))}` : `${Math.abs(Number(amount))}`,
      date: transactionDate as any,
      categoryId: finalCategoryId,
      type,
      note: selectedCategory?.name === "Other" && customCategory ? `${customCategory}${note ? ` - ${note}` : ""}` : note,
      isRecurring: false,
    }, {
      onSuccess: () => {
        setOpen(false);
        setAmount("");
        setNote("");
        setCustomCategory("");
      }
    });
  };

  const handleDebtSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!debtAmount || !contactName || !contactPhone) return;

    const parsedDebtDate = new Date(`${debtDate}T12:00:00`);

    createDebt({
      profileId,
      type: debtType,
      contactName,
      contactPhone,
      amount: debtAmount,
      note: debtNote,
      date: parsedDebtDate as any,
    }, {
      onSuccess: () => {
        setOpen(false);
        setContactName("");
        setContactPhone("");
        setDebtAmount("");
        setDebtNote("");
        setDebtDate(format(new Date(), "yyyy-MM-dd"));
      }
    });
  };

  const addParticipant = () => {
    if (!tempParticipantName || !tempParticipantPhone || !tempParticipantAmount) return;
    setParticipants([...participants, {
      name: tempParticipantName,
      phone: tempParticipantPhone,
      amount: tempParticipantAmount
    }]);
    setTempParticipantName("");
    setTempParticipantPhone("");
    setTempParticipantAmount("");
  };

  const removeParticipant = (idx: number) => {
    setParticipants(participants.filter((_, i) => i !== idx));
  };

  const participantTotal = participants.reduce((sum, participant) => sum + (Number(participant.amount) || 0), 0);

  const handleSplitSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!splitDescription || participants.length === 0) return;
    if (participantTotal <= 0) return;

    setIsSplitPending(true);
    try {
      const [year, month, day] = splitDate.split("-").map(Number);
      const splitEntryDate = new Date(year, month - 1, day);

      await apiRequest("POST", `/api/profiles/${profileId}/bill-splits`, {
        split: {
          description: splitDescription,
          amount: participantTotal,
          date: splitEntryDate,
        },
        participants: participants.map(p => ({
          contactName: p.name,
          contactPhone: p.phone,
          amount: p.amount
        }))
      });

      queryClient.invalidateQueries({ queryKey: ['/api/profiles', profileId, 'bill-splits'] });

      setOpen(false);
      setSplitDescription("");
      setSplitDate(format(new Date(), "yyyy-MM-dd"));
      setParticipants([]);

      toast({ title: "Success", description: "Split bill saved successfully." });
    } catch (err) {
      console.error("Failed to create split bill:", err);
      toast({ title: "Error", description: "Failed to save split bill. Please try again.", variant: "destructive" });
    } finally {
      setIsSplitPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button data-testid="button-add-record" className="rounded-full h-12 w-12 md:h-10 md:w-auto md:px-4 md:rounded-xl shadow-lg shadow-primary/20 bg-primary hover:bg-primary/90 transition-all hover:scale-105 active:scale-95">
          <Plus className="h-6 w-6 md:h-4 md:w-4 md:mr-2" />
          <span className="hidden md:inline">Add Record</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] rounded-2xl gap-6 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-display">New Entry</DialogTitle>
          <DialogDescription>Record a transaction, Udhari entry, or split a bill.</DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 rounded-xl h-10 p-1 bg-muted/50 mb-6">
            <TabsTrigger value="transaction" className="rounded-lg text-xs font-semibold">Transaction</TabsTrigger>
            <TabsTrigger value="udhari" className="rounded-lg text-xs font-semibold">Udhari (Khata)</TabsTrigger>
            <TabsTrigger value="splitbill" className="rounded-lg text-xs font-semibold">Split Bill</TabsTrigger>
          </TabsList>

          <TabsContent value="transaction">
            <form onSubmit={handleTxSubmit} className="space-y-6">
              <div className="flex bg-muted/50 p-1 rounded-xl">
                <button
                  type="button"
                  className={cn("flex-1 py-2 text-sm font-medium rounded-lg transition-all", type === "expense" ? "bg-white shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
                  onClick={() => setType("expense")}
                >
                  Expense
                </button>
                <button
                  type="button"
                  className={cn("flex-1 py-2 text-sm font-medium rounded-lg transition-all", type === "income" ? "bg-white shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
                  onClick={() => setType("income")}
                >
                  Income
                </button>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Amount</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">₹</span>
                    <input
                      data-testid="input-tx-amount"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      className="flex h-12 w-full border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 pl-8 text-lg font-semibold rounded-xl"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={categoryId} onValueChange={setCategoryId} required>
                    <SelectTrigger className="h-12 rounded-xl" data-testid="select-category">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredCategories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id.toString()}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {categories?.find(c => c.id === parseInt(categoryId))?.name === "Other" && (
                    <Input
                      placeholder="Describe this 'Other' expense"
                      value={customCategory}
                      onChange={(e) => setCustomCategory(e.target.value)}
                      className="h-12 rounded-xl mt-2"
                      required
                    />
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Date</Label>
                    <Input
                      data-testid="input-tx-date"
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="h-12 rounded-xl"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Time (Optional)</Label>
                    <Input
                      type="time"
                      value={time}
                      onChange={(e) => setTime(e.target.value)}
                      className="h-12 rounded-xl"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Note (Optional)</Label>
                  <Input
                    placeholder="What was this for?"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="h-12 rounded-xl"
                  />
                </div>
              </div>

              <Button type="submit" className="w-full h-12 rounded-xl text-base font-semibold shadow-lg shadow-primary/20" disabled={isTxPending}>
                {isTxPending ? <Loader2 className="h-5 w-5 animate-spin" /> : "Save Transaction"}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="udhari">
            <form onSubmit={handleDebtSubmit} className="space-y-6">
              <div className="flex bg-muted/50 p-1 rounded-xl">
                <button
                  type="button"
                  className={cn("flex-1 py-2 text-sm font-medium rounded-lg transition-all", debtType === "gave" ? "bg-white shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
                  onClick={() => setDebtType("gave")}
                >
                  I Gave (Lent)
                </button>
                <button
                  type="button"
                  className={cn("flex-1 py-2 text-sm font-medium rounded-lg transition-all", debtType === "got" ? "bg-white shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
                  onClick={() => setDebtType("got")}
                >
                  I Got (Borrowed)
                </button>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Amount</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">₹</span>
                    <input
                      data-testid="input-debt-amount"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      className="flex h-12 w-full border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 pl-8 text-lg font-semibold rounded-xl"
                      value={debtAmount}
                      onChange={(e) => setDebtAmount(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Contact Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      data-testid="input-debt-contact-name"
                      placeholder="Enter name"
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      className="rounded-xl pl-9 h-12"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Phone Number <span className="text-destructive">*</span></Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      data-testid="input-debt-phone"
                      placeholder="+91 XXXXX XXXXX"
                      type="tel"
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      className="rounded-xl pl-9 h-12"
                      required
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Required for SMS settlement reminders.</p>
                </div>

                <div className="space-y-2">
                  <Label>Date</Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      data-testid="input-debt-date"
                      type="date"
                      value={debtDate}
                      onChange={(e) => setDebtDate(e.target.value)}
                      className="rounded-xl pl-9 h-12"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Note / Purpose</Label>
                  <div className="relative">
                    <MessageSquare className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Details..."
                      value={debtNote}
                      onChange={(e) => setDebtNote(e.target.value)}
                      className="rounded-xl pl-9 h-12"
                    />
                  </div>
                </div>
              </div>

              <Button type="submit" className="w-full h-12 rounded-xl text-base font-semibold shadow-lg shadow-amber-500/20 bg-amber-600 hover:bg-amber-700 text-white" disabled={isDebtPending}>
                {isDebtPending ? <Loader2 className="h-5 w-5 animate-spin" /> : "Save Udhari Khata Transaction"}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="splitbill">
            <form onSubmit={handleSplitSubmit} className="space-y-6 pb-2">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Bill Description</Label>
                  <Input
                    data-testid="input-split-description"
                    placeholder="e.g., Dinner at restaurant"
                    value={splitDescription}
                    onChange={(e) => setSplitDescription(e.target.value)}
                    className="h-12 rounded-xl"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>Total Amount</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">₹</span>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="Auto-calculated from participant shares"
                      className="h-12 rounded-xl pl-8 bg-muted/50 text-lg font-semibold"
                      value={participantTotal > 0 ? participantTotal : ""}
                      readOnly
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Total amount is calculated from all split amounts.</p>
                </div>

                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input
                    data-testid="input-split-date"
                    type="date"
                    value={splitDate}
                    onChange={(e) => setSplitDate(e.target.value)}
                    className="h-12 rounded-xl"
                    required
                  />
                </div>

                <div className="space-y-3">
                  <Label>Participants</Label>
                  <div className="space-y-2 p-3 bg-muted/30 rounded-xl">
                    <Input
                      placeholder="Name"
                      value={tempParticipantName}
                      onChange={(e) => setTempParticipantName(e.target.value)}
                      className="h-10 rounded-lg text-sm"
                    />
                    <Input
                      placeholder="Phone number (required)"
                      type="tel"
                      value={tempParticipantPhone}
                      onChange={(e) => setTempParticipantPhone(e.target.value)}
                      className="h-10 rounded-lg text-sm"
                    />
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium text-sm">₹</span>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        className="flex h-10 w-full border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 pl-8 rounded-lg"
                        value={tempParticipantAmount}
                        onChange={(e) => setTempParticipantAmount(e.target.value)}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="w-full h-9 rounded-lg text-sm"
                      onClick={addParticipant}
                    >
                      + Add Participant
                    </Button>
                  </div>

                  {participants.length > 0 && (
                    <div className="max-h-56 overflow-y-auto pr-1 space-y-2">
                      {participants.map((p, idx) => (
                        <div key={idx} className="flex items-center justify-between gap-3 p-2 bg-muted rounded-lg text-sm">
                          <div className="min-w-0">
                            <p className="font-medium">{p.name}</p>
                            <p className="text-xs text-muted-foreground">{p.phone}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-bold whitespace-nowrap">₹ {Number(p.amount).toLocaleString('en-IN')}</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => removeParticipant(idx)}
                            >
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <Button
                data-testid="button-confirm-split"
                type="submit"
                className="w-full h-12 rounded-xl text-base font-semibold shadow-lg shadow-blue-500/20 bg-blue-600 hover:bg-blue-700 text-white"
                disabled={isSplitPending || participants.length === 0 || participantTotal <= 0}
              >
                {isSplitPending ? <Loader2 className="h-5 w-5 animate-spin" /> : "Confirm & Split Bill"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
