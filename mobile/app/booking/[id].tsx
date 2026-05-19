import { useCallback, useEffect, useState } from "react";
import { ScrollView, Text, TextInput, View, ActivityIndicator, Pressable, Alert } from "react-native";
import { useLocalSearchParams, useRouter, Link } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { CheckCircle2, Truck, Sparkles, MapPin, Clock, Phone, Star, Camera, RefreshCw, MessageSquareWarning, CreditCard, XCircle } from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import { Image } from "react-native";
import { Badge, Button, Card, SectionTitle } from "@/components/ui";
import { api, uploadProofPhoto, staticMapUrl } from "@/lib/api";

const FLOW = [
  { key: "confirmed", label: "Confirmed", Icon: CheckCircle2 },
  { key: "en_route", label: "En route", Icon: Truck },
  { key: "in_progress", label: "Working", Icon: Sparkles },
  { key: "completed", label: "Done", Icon: CheckCircle2 },
];

type Booking = Record<string, any>;

export default function BookingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [showDispute, setShowDispute] = useState(false);

  const fetchBooking = useCallback(async () => {
    if (!id) return;
    try {
      const r = await api.getBooking(id);
      setBooking(r.booking);
    } catch (e) {
      Alert.alert("Error", (e as Error).message);
    }
  }, [id]);

  useEffect(() => { fetchBooking(); }, [fetchBooking]);

  if (!booking) {
    return <View className="flex-1 items-center justify-center bg-bg"><ActivityIndicator color="#a78bfa" /></View>;
  }

  const currentStep = FLOW.findIndex((s) => s.key === booking.status);
  const provider = booking.providers;

  async function setStatus(status: string, extra: Record<string, unknown> = {}) {
    if (!id) return;
    setBusy(status);
    try {
      await api.setStatus(id, status, extra);
      await fetchBooking();
    } catch (e) { Alert.alert("Error", (e as Error).message); }
    finally { setBusy(null); }
  }

  async function submitReview() {
    if (!id || !rating) return;
    setBusy("review");
    try {
      await api.review(id, rating, comment);
      await fetchBooking();
    } catch (e) { Alert.alert("Error", (e as Error).message); }
    finally { setBusy(null); }
  }

  async function pickAndCompleteWithProof() {
    if (!id) return;
    // 1. Permission + pick
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission required", "Please grant photo access to upload service proof.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsEditing: false,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];

    setBusy("completed");
    try {
      // 2. Get signed upload URL
      const contentType = (asset.mimeType ?? "image/jpeg") as "image/jpeg" | "image/png" | "image/webp";
      const ticket = await api.uploadProofTicket(id, contentType === "image/jpeg" || contentType === "image/png" || contentType === "image/webp" ? contentType : "image/jpeg");

      // 3. Read file & upload
      const fileResp = await fetch(asset.uri);
      const blob = await fileResp.blob();
      await uploadProofPhoto(ticket, blob);

      // 4. Mark booking completed with the public URL
      await api.setStatus(id, "completed", {
        proof_photo_urls: [ticket.public_url],
        completion_checklist: { filter_cleaned: true, gas_pressure_ok: true, drain_test: true },
      });
      await fetchBooking();
    } catch (e) {
      Alert.alert("Upload failed", (e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function tryPayment(force: "auto" | "fail" | "succeed") {
    if (!id) return;
    setBusy("payment");
    try {
      const r = await api.payment(id, "card", force);
      if (r.status === "authorized") {
        Alert.alert("Payment authorized", `Card payment authorized on attempt ${r.attempts}.`);
      } else {
        Alert.alert(
          "Payment failed",
          `Reason: ${r.reason}. Attempts: ${r.attempts}. ${r.retry_allowed ? "Retry allowed." : "No more retries."}\n\nAlternatives:\n• ${r.alternatives.join("\n• ")}`,
        );
      }
      await fetchBooking();
    } catch (e) { Alert.alert("Error", (e as Error).message); }
    finally { setBusy(null); }
  }

  async function triggerReschedule() {
    if (!id) return;
    setBusy("reschedule");
    try {
      await api.setStatus(id, "cancelled_by_provider", { reason: "demo simulation" });
      await api.reschedule(id);
      await fetchBooking();
    } catch (e) { Alert.alert("Error", (e as Error).message); }
    finally { setBusy(null); }
  }

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={["bottom"]}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 32 }}>
        <View className="flex-row items-center">
          <Badge tone="brand">{String(booking.status).replace("_", " ")}</Badge>
          <Link href={{ pathname: "/trace/[id]", params: { id } }} asChild>
            <Pressable className="ml-auto">
              <Text className="text-[11px] text-brand-soft">View agent trace →</Text>
            </Pressable>
          </Link>
        </View>

        {/* Provider */}
        <Card>
          <View className="flex-row items-start gap-3">
            <View className="size-11 rounded-xl bg-brand/10 border border-brand/20 items-center justify-center">
              <Sparkles size={20} color="#a78bfa" />
            </View>
            <View className="flex-1">
              <Text className="text-ink font-medium">{provider?.name}</Text>
              <View className="flex-row items-center gap-3 mt-1">
                <View className="flex-row items-center gap-1">
                  <Star size={11} color="#a1a1aa" />
                  <Text className="text-[11px] text-ink-muted">{Number(provider?.rating_avg ?? 0).toFixed(1)}</Text>
                </View>
                <View className="flex-row items-center gap-1">
                  <MapPin size={11} color="#a1a1aa" />
                  <Text className="text-[11px] text-ink-muted">{provider?.area ?? provider?.city}</Text>
                </View>
              </View>
            </View>
            {provider?.phone ? (
              <Button variant="secondary" size="sm" onPress={() => Alert.alert("Call provider", provider.phone)}>
                <Phone size={14} color="#f5f5f7" />
                <Text className="text-ink text-sm font-medium">Call</Text>
              </Button>
            ) : null}
          </View>
          <View className="border-t border-line mt-3 pt-3">
            <View className="flex-row items-center gap-2">
              <Clock size={14} color="#a1a1aa" />
              <Text className="text-sm text-ink">
                {new Date(booking.scheduled_start).toLocaleString("en-GB", { weekday: "long", hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" })}
              </Text>
            </View>
            <View className="flex-row items-center gap-2 mt-1">
              <MapPin size={14} color="#a1a1aa" />
              <Text className="text-sm text-ink">{booking.parsed_intent?.location?.area ?? booking.parsed_intent?.location?.city}</Text>
            </View>
            <View className="flex-row gap-2 mt-3 flex-wrap">
              <MetricPill label="On-time" value={`${Math.round(Number(provider?.on_time_score ?? 0) * 100)}%`} />
              <MetricPill label="Cancel risk" value={`${Math.round(Number(provider?.cancel_rate ?? 0) * 100)}%`} tone={Number(provider?.cancel_rate ?? 0) > 0.12 ? "warn" : "accent"} />
              <MetricPill label="Total" value={`PKR ${Number(booking.total_price ?? 0).toLocaleString()}`} />
            </View>
          </View>
        </Card>

        {/* Lifecycle */}
        <View>
          <SectionTitle hint="From confirmation to completion">Service progress</SectionTitle>
          <Card>
            <View className="flex-row gap-2">
              {FLOW.map((s, i) => {
                const done = i <= currentStep;
                const Icon = s.Icon;
                return (
                  <View key={s.key} className="flex-1 items-center">
                    <View className={`size-9 rounded-full items-center justify-center ${done ? "bg-brand" : "bg-bg-elev border border-line"}`}>
                      <Icon size={16} color={done ? "#fff" : "#71717a"} />
                    </View>
                    <Text className={`text-[10px] uppercase mt-1 ${done ? "text-ink" : "text-ink-dim"}`}>{s.label}</Text>
                  </View>
                );
              })}
            </View>

            {/* En Route Map */}
            {booking.status === "en_route" && (booking.location_lat || provider?.lat) && (
              <View className="mt-4 rounded-xl overflow-hidden border border-line bg-bg-soft">
                <Image
                  source={{
                    uri: staticMapUrl(
                      booking.location_lat ?? provider?.lat,
                      booking.location_lng ?? provider?.lng,
                      booking.location_lat ? provider?.lat : undefined,
                      booking.location_lng ? provider?.lng : undefined
                    ),
                  }}
                  style={{ width: "100%", height: 160 }}
                  resizeMode="cover"
                />
                <View className="absolute bottom-2 left-2 bg-bg/90 px-2 py-1 rounded border border-line flex-row items-center gap-1">
                  <MapPin size={10} color="#a78bfa" />
                  <Text className="text-[10px] text-ink font-medium">Provider is on the way</Text>
                </View>
              </View>
            )}

            {/* Action buttons */}
            {booking.status === "confirmed" && (
              <View className="flex-row gap-2 mt-4 flex-wrap">
                <Button variant="secondary" size="sm" onPress={() => setStatus("en_route")} disabled={!!busy}>
                  <Truck size={14} color="#f5f5f7" />
                  <Text className="text-ink text-sm">{busy === "en_route" ? "…" : "Provider en route"}</Text>
                </Button>
                <Button variant="ghost" size="sm" onPress={triggerReschedule} disabled={!!busy}>
                  <RefreshCw size={14} color="#f5f5f7" />
                  <Text className="text-ink text-sm">{busy === "reschedule" ? "…" : "Simulate cancel"}</Text>
                </Button>
              </View>
            )}
            {booking.status === "en_route" && (
              <Button variant="secondary" size="sm" className="mt-4" onPress={() => setStatus("in_progress")} disabled={!!busy}>
                <Sparkles size={14} color="#f5f5f7" />
                <Text className="text-ink text-sm">{busy === "in_progress" ? "…" : "Mark arrived"}</Text>
              </Button>
            )}
            {booking.status === "in_progress" && (
              <View className="gap-2 mt-4">
                <Button size="sm" onPress={pickAndCompleteWithProof} disabled={!!busy}>
                  <Camera size={14} color="#fff" />
                  <Text className="text-white text-sm">{busy === "completed" ? "Uploading…" : "Pick photo + complete"}</Text>
                </Button>
                <Button variant="ghost" size="sm" onPress={() => setStatus("completed", { completion_checklist: { filter_cleaned: true } })} disabled={!!busy}>
                  <CheckCircle2 size={14} color="#71717a" />
                  <Text className="text-ink-dim text-xs">Skip photo (demo)</Text>
                </Button>
              </View>
            )}
          </Card>
        </View>

        {/* Payment */}
        {(booking.status === "confirmed" || booking.status === "en_route") && (
          <View>
            <SectionTitle hint={
              booking.payment_status === "authorized" ? "Authorized" :
              booking.payment_status === "failed" ? "Last attempt failed" : "Card not yet authorized"
            }>Payment</SectionTitle>
            <Card>
              <View className="flex-row items-center gap-2 mb-2">
                {booking.payment_status === "authorized" ? <CheckCircle2 size={16} color="#10b981" />
                  : booking.payment_status === "failed" ? <XCircle size={16} color="#ef4444" />
                  : <CreditCard size={16} color="#a78bfa" />}
                <Text className="text-sm text-ink">
                  Status: <Text className="font-mono">{booking.payment_status ?? "unpaid"}</Text>
                </Text>
                <Text className="ml-auto text-[11px] text-ink-dim">attempts: {booking.payment_attempts ?? 0}</Text>
              </View>
              <View className="flex-row gap-2 flex-wrap">
                <Button size="sm" variant="secondary" onPress={() => tryPayment("auto")} disabled={!!busy}>
                  <CreditCard size={12} color="#f5f5f7" />
                  <Text className="text-ink text-xs">{busy === "payment" ? "…" : "Pay (auto)"}</Text>
                </Button>
                <Button size="sm" variant="ghost" onPress={() => tryPayment("fail")} disabled={!!busy}>
                  <XCircle size={12} color="#f5f5f7" />
                  <Text className="text-ink text-xs">Force fail</Text>
                </Button>
              </View>
              <Text className="text-[10px] text-ink-dim mt-2">
                Demo: "auto" fails when total is divisible by 7. "Force fail" exercises the fallback (retry, COD, switch provider).
              </Text>
            </Card>
          </View>
        )}

        {/* Proof photos */}
        {Array.isArray(booking.proof_photo_urls) && booking.proof_photo_urls.length > 0 && (
          <View>
            <SectionTitle>Proof of work</SectionTitle>
            <Card>
              <View className="flex-row flex-wrap gap-2">
                {(booking.proof_photo_urls as string[]).map((url, i) => (
                  <Image
                    key={i}
                    source={{ uri: url }}
                    style={{ width: 140, height: 100, borderRadius: 10 }}
                    resizeMode="cover"
                  />
                ))}
              </View>
            </Card>
          </View>
        )}

        {/* Quote */}
        <View>
          <SectionTitle hint="Transparent line items">Quote breakdown</SectionTitle>
          <Card>
            {booking.price_breakdown?.line_items?.map((li: any, idx: number) => (
              <View key={idx} className="flex-row justify-between py-1">
                <View className="flex-1 mr-2">
                  <Text className="text-sm text-ink">{li.label}</Text>
                  {li.note ? <Text className="text-[11px] text-ink-dim">{li.note}</Text> : null}
                </View>
                <Text className={`text-sm font-mono ${li.amount < 0 ? "text-accent" : "text-ink"}`}>
                  {li.amount < 0 ? "−" : ""}PKR {Math.abs(li.amount).toLocaleString()}
                </Text>
              </View>
            ))}
            <View className="border-t border-line mt-2 pt-2 flex-row justify-between">
              <Text className="text-ink font-semibold">Total</Text>
              <Text className="text-ink font-semibold font-mono">PKR {Number(booking.total_price ?? 0).toLocaleString()}</Text>
            </View>
            {booking.price_breakdown?.fairness && (
              <View className="border-t border-line mt-3 pt-3 gap-1">
                <Text className="text-[11px] text-ink-muted"><Text className="text-ink">Fair to you:</Text> {booking.price_breakdown.fairness.user_view}</Text>
                <Text className="text-[11px] text-ink-muted"><Text className="text-ink">Fair to provider:</Text> {booking.price_breakdown.fairness.provider_view}</Text>
              </View>
            )}
          </Card>
        </View>

        {/* Review */}
        {booking.status === "completed" && !booking.rating && (
          <View>
            <SectionTitle>Rate the service</SectionTitle>
            <Card>
              <View className="flex-row gap-2 mb-3">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Pressable key={n} onPress={() => setRating(n)} className="p-1">
                    <Star size={28} color={n <= rating ? "#f59e0b" : "#71717a"} fill={n <= rating ? "#f59e0b" : "transparent"} />
                  </Pressable>
                ))}
              </View>
              <TextInput
                value={comment}
                onChangeText={setComment}
                placeholder="Optional comment…"
                placeholderTextColor="#71717a"
                multiline
                numberOfLines={2}
                className="bg-bg-soft border border-line rounded-xl px-3 py-2 text-sm text-ink min-h-[60px]"
                textAlignVertical="top"
              />
              <Button onPress={submitReview} disabled={!rating || !!busy} size="sm" className="mt-3">
                <CheckCircle2 size={14} color="#fff" />
                <Text className="text-white text-sm font-medium">{busy === "review" ? "Submitting…" : "Submit review"}</Text>
              </Button>
            </Card>
          </View>
        )}

        {booking.rating ? (
          <View>
            <SectionTitle>Customer feedback</SectionTitle>
            <Card>
              <View className="flex-row gap-1 mb-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star key={n} size={18} color={n <= Number(booking.rating) ? "#f59e0b" : "#71717a"} fill={n <= Number(booking.rating) ? "#f59e0b" : "transparent"} />
                ))}
              </View>
              {booking.rating_comment ? (
                <Text className="text-sm text-ink-muted">{booking.rating_comment}</Text>
              ) : (
                <Text className="text-sm text-ink-dim">Rating submitted.</Text>
              )}
            </Card>
          </View>
        ) : null}

        {/* Dispute */}
        {(booking.status === "completed" || booking.status === "in_progress") && (
          <View>
            <SectionTitle>Issue with the service?</SectionTitle>
            {!showDispute ? (
              <Button variant="secondary" size="sm" onPress={() => setShowDispute(true)}>
                <MessageSquareWarning size={14} color="#f5f5f7" />
                <Text className="text-ink text-sm">File a dispute</Text>
              </Button>
            ) : (
              <DisputeForm bookingId={id!} onDone={fetchBooking} onClose={() => setShowDispute(false)} />
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function MetricPill({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "accent" | "warn" }) {
  const toneClass = {
    default: "border-line bg-bg-soft text-ink",
    accent: "border-accent/30 bg-accent/10 text-accent",
    warn: "border-warn/30 bg-warn/10 text-warn",
  }[tone];
  return (
    <View className={`rounded-xl border px-3 py-2 ${toneClass}`}>
      <Text className="text-[10px] uppercase text-ink-dim">{label}</Text>
      <Text className={`text-xs font-medium ${tone === "default" ? "text-ink" : tone === "accent" ? "text-accent" : "text-warn"}`}>{value}</Text>
    </View>
  );
}

function DisputeForm({ bookingId, onDone, onClose }: { bookingId: string; onDone: () => void; onClose: () => void }) {
  const [caseType, setCaseType] = useState<"quality" | "no_show" | "late_arrival" | "price" | "overrun">("quality");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);

  const cases: { key: typeof caseType; label: string }[] = [
    { key: "quality", label: "Quality issue" },
    { key: "no_show", label: "Didn't arrive" },
    { key: "late_arrival", label: "Very late" },
    { key: "price", label: "Price differs" },
    { key: "overrun", label: "Overran" },
  ];

  async function submit() {
    setSubmitting(true);
    try {
      const r: any = await api.dispute({ booking_id: bookingId, raised_by: "user", case_type: caseType, description });
      setResult(r.decision);
      onDone();
    } catch (e) { Alert.alert("Error", (e as Error).message); }
    finally { setSubmitting(false); }
  }

  return (
    <Card className="border-danger/30">
      <View className="flex-row gap-1 flex-wrap mb-3">
        {cases.map((c) => (
          <Pressable
            key={c.key}
            onPress={() => setCaseType(c.key)}
            className={`px-3 py-1 rounded-full border ${caseType === c.key ? "bg-brand border-brand" : "bg-bg-soft border-line"}`}
          >
            <Text className={`text-[11px] ${caseType === c.key ? "text-white" : "text-ink-muted"}`}>{c.label}</Text>
          </Pressable>
        ))}
      </View>
      <TextInput
        value={description}
        onChangeText={setDescription}
        placeholder="What happened?"
        placeholderTextColor="#71717a"
        multiline
        numberOfLines={3}
        className="bg-bg-soft border border-line rounded-xl px-3 py-2 text-sm text-ink min-h-[70px]"
        textAlignVertical="top"
      />
      <Button variant="danger" size="sm" className="mt-3" onPress={submit} disabled={submitting}>
        <MessageSquareWarning size={14} color="#fff" />
        <Text className="text-white text-sm font-medium">{submitting ? "Submitting…" : "Submit dispute"}</Text>
      </Button>
      {result && (
        <View className="bg-bg-soft rounded-lg p-3 mt-3 border border-line">
          <Text className="text-xs text-ink font-medium mb-1">Resolution decision</Text>
          <Text className="text-[11px] font-mono text-ink-muted">{JSON.stringify(result, null, 2)}</Text>
          <Button variant="ghost" size="sm" className="mt-3" onPress={onClose}>
            <Text className="text-ink-dim text-xs">Done</Text>
          </Button>
        </View>
      )}
    </Card>
  );
}
