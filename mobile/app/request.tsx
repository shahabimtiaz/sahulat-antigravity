import { useEffect, useRef, useState } from "react";
import { ScrollView, Text, TextInput, View, ActivityIndicator, Alert, Pressable, Image } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Send, Star, Clock, ChevronRight, Receipt, AlertTriangle, Brain, CalendarCheck, WalletCards, ShieldCheck, MapPin } from "lucide-react-native";
import { Badge, Button, Card, SectionTitle } from "@/components/ui";
import { LocationPicker, type PickedLocation } from "@/components/LocationPicker";
import { api, placesPhotoUrl, type OrchestrateResult, type RankedProvider, type PriceQuote } from "@/lib/api";

const REQUEST_SAMPLES = [
  "AC service kal subah G-13 mein, budget thora tight hai.",
  "Female beautician F-7 tomorrow evening for facial.",
  "Plumber chahiye abhi, I-8 bathroom leak.",
];

const PIPELINE = [
  { label: "Intent", Icon: Brain },
  { label: "Match", Icon: ShieldCheck },
  { label: "Price", Icon: WalletCards },
  { label: "Slot", Icon: CalendarCheck },
];

export default function Request() {
  const params = useLocalSearchParams<{ q?: string }>();
  const router = useRouter();
  const [message, setMessage] = useState<string>(params.q ?? "");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<OrchestrateResult | null>(null);
  const [picked, setPicked] = useState<{ providerId: string; slot: { start: string; end: string }; quote: PriceQuote } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [location, setLocation] = useState<PickedLocation | null>(null);
  const messageRef = useRef(message);

  function updateMessage(value: string) {
    messageRef.current = value;
    setMessage(value);
  }

  useEffect(() => {
    if (params.q) updateMessage(params.q);
  }, [params.q]);

  const effectiveMessage = (message || params.q || "").trim();

  async function submit() {
    const requestText = (messageRef.current || message || params.q || "").trim();
    if (!requestText || loading) return;
    setLoading(true);
    setResult(null);
    setRequestError(null);
    try {
      // If the user picked a precise location from Places, pass lat/lng to
      // anchor the discovery search instead of relying on text-parsed area.
      const loc = location?.lat && location?.lng
        ? { lat: location.lat, lng: location.lng }
        : undefined;
      const messageWithLocation = location?.label && !requestText.toLowerCase().includes(location.label.toLowerCase())
        ? `${requestText} (location: ${location.label}${location.secondary ? ", " + location.secondary : ""})`
        : requestText;
      const r = await api.orchestrate(messageWithLocation, loc);
      setResult(r);
      if (r.status === "offer" && (r.ranking?.length ?? 0) > 0 && r.schedule?.status === "confirmed" && r.schedule.slot && r.top_quote) {
        const selectedProviderId = r.schedule.slot.provider_id;
        const selectedQuote = r.quotes?.[selectedProviderId] ?? r.top_quote;
        setPicked({
          providerId: selectedProviderId,
          slot: { start: r.schedule.slot.start, end: r.schedule.slot.end },
          quote: selectedQuote,
        });
      }
    } catch (e) {
      setRequestError((e as Error).message);
      Alert.alert("Request failed", (e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function confirm() {
    if (!result || !picked) return;
    setConfirming(true);
    try {
      const r = await api.confirm({
        request_id: result.request_id,
        intent: result.intent,
        provider_id: picked.providerId,
        slot_start: picked.slot.start,
        slot_end: picked.slot.end,
        price_breakdown: picked.quote,
        request_text: (messageRef.current || message || params.q || "").trim(),
      });
      if (r.status === "conflict") {
        Alert.alert("Slot taken", "Another customer just reserved this slot. Please pick a different provider or time.");
        return;
      }
      router.replace({ pathname: "/booking/[id]", params: { id: r.booking_id! } });
    } catch (e) {
      Alert.alert("Booking failed", (e as Error).message);
    } finally {
      setConfirming(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={["bottom"]}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 140 }}>
        <Card>
          <SectionTitle>Describe what you need</SectionTitle>
          <TextInput
            value={message}
            onChangeText={updateMessage}
            onChange={(event) => updateMessage(event.nativeEvent.text)}
            placeholder="e.g. AC bilkul kaam nahi kar raha, kal subah G-13 mein..."
            placeholderTextColor="#71717a"
            multiline
            numberOfLines={3}
            className="bg-bg-soft border border-line rounded-xl px-3 py-2.5 text-ink text-base min-h-[80px]"
            textAlignVertical="top"
          />
          <View className="flex-row flex-wrap gap-2 mt-3">
            {REQUEST_SAMPLES.map((sample) => (
              <Pressable
                key={sample}
                onPress={() => updateMessage(sample)}
                className="bg-bg-soft border border-line rounded-full px-3 py-1.5 active:bg-line-soft"
              >
                <Text className="text-[11px] text-ink-muted">{sample}</Text>
              </Pressable>
            ))}
          </View>
          <View className="mt-3">
            <Text className="text-[10px] uppercase tracking-wider text-ink-dim mb-1.5">Location (optional, more accurate)</Text>
            <LocationPicker
              value={location}
              onChange={setLocation}
              biasLat={33.6844}
              biasLng={73.0479}
              placeholder="Search address — powered by Google Places"
            />
          </View>
          <View className="flex-row items-center justify-between mt-3">
            <Text className="text-[11px] text-ink-dim">Urdu · Roman Urdu · English supported</Text>
            <Button onPress={submit} disabled={loading || !effectiveMessage} size="sm">
              {loading ? <ActivityIndicator color="#fff" size="small" /> : <Send size={14} color="#fff" />}
              <Text className="text-white text-sm font-medium ml-1">{loading ? "Thinking…" : "Send"}</Text>
            </Button>
          </View>
        </Card>

        <PipelineCard loading={loading} result={result} />

        {requestError && (
          <Card className="border-danger/40">
            <View className="flex-row items-center gap-2">
              <AlertTriangle size={16} color="#ef4444" />
              <Text className="text-ink font-medium">Request failed</Text>
            </View>
            <Text className="text-sm text-ink-muted mt-2">{requestError}</Text>
          </Card>
        )}

        {result?.trace?.some((t) => t.agent === "fallback") && (
          <Card className="border-warn/30">
            <View className="flex-row items-center gap-2">
              <AlertTriangle size={14} color="#f59e0b" />
              <Text className="text-ink text-sm font-medium">Robustness fallback active</Text>
            </View>
            <Text className="text-[11px] text-ink-muted mt-1">
              {result.trace.find((t) => t.agent === "fallback")?.rationale ?? "An LLM step degraded gracefully to rule-based extraction. The workflow completed end-to-end."}
            </Text>
          </Card>
        )}

        {result && <ResultBlock result={result} picked={picked} setPicked={setPicked} />}
      </ScrollView>

      {result?.status === "offer" && picked && (
        <View className="absolute left-3 right-3 bottom-6 bg-bg-elev border border-brand rounded-2xl p-3 flex-row items-center gap-3 shadow-2xl">
          <View className="flex-1">
            <Text className="text-[11px] text-ink-muted">Confirm total</Text>
            <Text className="text-lg font-semibold text-ink">PKR {picked.quote.total.toLocaleString()}</Text>
          </View>
          <Button onPress={confirm} disabled={confirming}>
            {confirming ? <ActivityIndicator color="#fff" size="small" /> : <ChevronRight size={16} color="#fff" />}
            <Text className="text-white font-medium">{confirming ? "Booking…" : "Confirm"}</Text>
          </Button>
        </View>
      )}
    </SafeAreaView>
  );
}

function PipelineCard({ loading, result }: { loading: boolean; result: OrchestrateResult | null }) {
  const activeLabel = loading
    ? "Antigravity agents are parsing, ranking, pricing, and checking capacity."
    : result
      ? `${result.trace?.length ?? 0} trace events captured for this request.`
      : "Ready to run the Antigravity booking workflow.";

  return (
    <Card className="py-3">
      <View className="flex-row items-center gap-2 mb-3">
        <View className="size-8 rounded-xl bg-accent/10 border border-accent/30 items-center justify-center">
          {loading ? <ActivityIndicator size="small" color="#34d399" /> : <Brain size={15} color="#34d399" />}
        </View>
        <View className="flex-1">
          <Text className="text-ink text-sm font-medium">Agent pipeline</Text>
          <Text className="text-[11px] text-ink-muted">{activeLabel}</Text>
        </View>
      </View>
      <View className="flex-row gap-2">
        {PIPELINE.map(({ label, Icon }, i) => {
          const done = Boolean(result) || (loading && i === 0);
          return (
            <View key={label} className={`flex-1 rounded-xl border px-2 py-2 ${done ? "bg-accent/10 border-accent/30" : "bg-bg-soft border-line"}`}>
              <Icon size={14} color={done ? "#34d399" : "#71717a"} />
              <Text className={`text-[10px] mt-1 ${done ? "text-accent-soft" : "text-ink-dim"}`}>{label}</Text>
            </View>
          );
        })}
      </View>
    </Card>
  );
}

function ResultBlock({
  result, picked, setPicked,
}: {
  result: OrchestrateResult;
  picked: { providerId: string; slot: { start: string; end: string }; quote: PriceQuote } | null;
  setPicked: (p: { providerId: string; slot: { start: string; end: string }; quote: PriceQuote } | null) => void;
}) {
  if (result.status === "needs_clarification") {
    return (
      <Card className="border-warn/30">
        <View className="flex-row items-center gap-2 mb-2">
          <AlertTriangle size={16} color="#f59e0b" />
          <Text className="text-ink font-medium">A couple of clarifications</Text>
          <View className="ml-auto"><Badge tone="warn">conf {Number(result.intent.confidence).toFixed(2)}</Badge></View>
        </View>
        {result.questions?.map((q, i) => (
          <View key={i} className="bg-bg-soft rounded-lg px-3 py-2 mb-2">
            <Text className="text-sm text-ink">{q}</Text>
          </View>
        ))}
      </Card>
    );
  }
  if (result.status === "no_providers" || result.status === "waitlisted") {
    return (
      <Card className="border-warn/30">
        <View className="flex-row items-center gap-2 mb-2">
          <AlertTriangle size={16} color="#f59e0b" />
          <Text className="text-ink font-medium">No provider available</Text>
        </View>
        <Text className="text-sm text-ink-muted">{result.rationale ?? "We'll alert you as soon as someone is free."}</Text>
      </Card>
    );
  }
  if (result.status !== "offer") return null;

  return (
    <View className="gap-4">
      <IntentCard intent={result.intent} />
      <TraceSummaryCard result={result} />
      <View>
        <SectionTitle hint={`${result.ranking?.length ?? 0} ranked from a multi-factor score`}>Top matches</SectionTitle>
        <View className="gap-3">
          {(result.ranking ?? []).map((r, i) => {
            const isPicked = picked?.providerId === r.provider_id;
            const quote = result.quotes?.[r.provider_id] ?? (i === 0 ? result.top_quote : (i === 1 ? result.alt_quote : undefined));
            const confirmedSlot = result.schedule?.status === "confirmed" ? result.schedule.slot : undefined;
            const slot = confirmedSlot?.provider_id === r.provider_id
              ? confirmedSlot
              : result.schedule?.alternates?.find((a) => a.provider_id === r.provider_id);
            return (
              <Card key={r.provider_id} className={isPicked ? "border-brand border-2" : ""}>
                <View className="flex-row items-start gap-3">
                  <ProviderAvatar provider={r} index={i} />
                  <View className="flex-1">
                    <View className="flex-row items-center gap-2 flex-wrap">
                      <Text className="text-ink font-medium flex-1" numberOfLines={1}>{r.name}</Text>
                      <Badge tone="accent">{r.score.toFixed(0)} score</Badge>
                    </View>
                    {r.provider.external_place_id ? (
                      <View className="flex-row items-center gap-1 mt-0.5">
                        <MapPin size={10} color="#71717a" />
                        <Text className="text-[10px] text-ink-dim">Verified via Google Places</Text>
                      </View>
                    ) : null}
                    <View className="flex-row items-center gap-3 mt-1">
                      <View className="flex-row items-center gap-1">
                        <Star size={11} color="#a1a1aa" />
                        <Text className="text-[11px] text-ink-muted">{r.provider.rating_avg.toFixed(1)} ({r.provider.rating_count})</Text>
                      </View>
                      <Text className="text-[11px] text-ink-muted">{r.distance_km}km</Text>
                      <Text className="text-[11px] text-ink-muted">on-time {(r.provider.on_time_score * 100).toFixed(0)}%</Text>
                    </View>
                    <Text className="text-sm text-ink-muted mt-2">{r.why}</Text>
                    <FactorStrip provider={r} />
                    {r.flags.length > 0 && (
                      <View className="flex-row gap-1 mt-2 flex-wrap">
                        {r.flags.map((f) => (
                          <Badge key={f} tone={f.includes("negative") || f.includes("cancel") ? "warn" : "default"}>
                            {f.replaceAll("_", " ")}
                          </Badge>
                        ))}
                      </View>
                    )}
                  </View>
                </View>

                {quote && (
                  <View className="mt-3 bg-bg-soft rounded-xl p-3 border border-line gap-1">
                    <View className="flex-row items-center mb-1">
                      <Receipt size={12} color="#a1a1aa" />
                      <Text className="text-[11px] uppercase font-semibold text-ink-muted ml-1">Quote</Text>
                      <Text className="ml-auto text-ink font-mono">PKR {quote.total.toLocaleString()}</Text>
                    </View>
                    {quote.line_items.map((li, idx) => (
                      <View key={idx} className="flex-row justify-between">
                        <Text className="text-[11px] text-ink-muted flex-1" numberOfLines={1}>{li.label}</Text>
                        <Text className={`text-[11px] font-mono ${li.amount < 0 ? "text-accent" : "text-ink"}`}>
                          {li.amount < 0 ? "−" : ""}PKR {Math.abs(li.amount).toLocaleString()}
                        </Text>
                      </View>
                    ))}
                    {quote.budget_friendly_alternative && (
                      <Text className="text-[11px] text-accent border-t border-line pt-2 mt-1">
                        💡 Budget option: PKR {quote.budget_friendly_alternative.total.toLocaleString()} — {quote.budget_friendly_alternative.swap}
                      </Text>
                    )}
                  </View>
                )}

                {slot && (
                  <View className="flex-row items-center gap-1 mt-2">
                    <Clock size={12} color="#71717a" />
                    <Text className="text-[11px] text-ink-muted">
                      Slot: {new Date(slot.start).toLocaleString("en-GB", { weekday: "short", hour: "2-digit", minute: "2-digit" })}
                    </Text>
                  </View>
                )}

                {quote && slot && (
                  <Button
                    variant={isPicked ? "primary" : "secondary"}
                    size="sm"
                    className="mt-3"
                    onPress={() => setPicked({ providerId: r.provider_id, slot, quote })}
                  >
                    <Text className={`${isPicked ? "text-white" : "text-ink"} text-sm font-medium`}>
                      {isPicked ? "Selected" : "Choose this provider"}
                    </Text>
                  </Button>
                )}
              </Card>
            );
          })}
        </View>
      </View>
    </View>
  );
}

function TraceSummaryCard({ result }: { result: OrchestrateResult }) {
  const agents = Array.from(new Set((result.trace ?? []).map((t) => t.agent))).slice(0, 6);
  const schedule = result.schedule?.status ? String(result.schedule.status).replaceAll("_", " ") : "pending";
  return (
    <Card>
      <View className="flex-row items-start gap-3">
        <View className="size-10 rounded-xl bg-brand/10 border border-brand/20 items-center justify-center">
          <ShieldCheck size={18} color="#a78bfa" />
        </View>
        <View className="flex-1">
          <View className="flex-row items-center gap-2 flex-wrap">
            <Text className="text-ink font-medium">Antigravity trace</Text>
            <Badge tone="brand">{result.trace?.length ?? 0} events</Badge>
            <Badge tone={result.schedule?.status === "confirmed" ? "accent" : "warn"}>{schedule}</Badge>
          </View>
          <Text className="text-sm text-ink-muted mt-1">
            Provider choice, quote math, capacity checks, and fallbacks are recorded for audit.
          </Text>
          <View className="flex-row gap-1 mt-2 flex-wrap">
            {agents.map((agent) => <Badge key={agent} tone="default">{agent}</Badge>)}
          </View>
        </View>
      </View>
    </Card>
  );
}

function ProviderAvatar({ provider, index }: { provider: RankedProvider; index: number }) {
  const placeId = provider.provider.external_place_id;
  const [errored, setErrored] = useState(false);
  if (placeId && !errored) {
    return (
      <View className="size-14 rounded-2xl overflow-hidden border border-line bg-bg-soft items-center justify-center">
        <Image
          source={{ uri: placesPhotoUrl(placeId, 200) }}
          onError={() => setErrored(true)}
          style={{ width: "100%", height: "100%" }}
        />
        <View className="absolute top-1 left-1 bg-bg/80 rounded-full px-1.5 py-0.5">
          <Text className="text-[9px] text-brand-soft font-semibold">#{index + 1}</Text>
        </View>
      </View>
    );
  }
  return (
    <View
      className="size-14 rounded-2xl items-center justify-center border border-line"
      style={{ backgroundColor: ["#7c5cff20", "#10b98120", "#f59e0b20", "#ef444420"][index % 4] }}
    >
      <Text className="text-brand-soft text-sm font-semibold">#{index + 1}</Text>
    </View>
  );
}

function FactorStrip({ provider }: { provider: RankedProvider }) {
  const factors = Object.entries(provider.breakdown ?? {})
    .sort(([, a], [, b]) => Math.abs(b.weighted) - Math.abs(a.weighted))
    .slice(0, 4);
  if (factors.length === 0) return null;

  return (
    <View className="mt-3 gap-2">
      {factors.map(([name, score]) => {
        const width = `${Math.min(100, Math.max(8, Math.abs(score.raw) * 100))}%` as `${number}%`;
        const positive = score.weighted >= 0;
        return (
          <View key={name}>
            <View className="flex-row justify-between mb-1">
              <Text className="text-[10px] text-ink-dim">{name.replaceAll("_", " ")}</Text>
              <Text className={`text-[10px] font-mono ${positive ? "text-accent" : "text-warn"}`}>{score.weighted.toFixed(1)}</Text>
            </View>
            <View className="h-1.5 rounded-full bg-bg-soft overflow-hidden border border-line">
              <View className={`h-full rounded-full ${positive ? "bg-accent" : "bg-warn"}`} style={{ width }} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

function IntentCard({ intent }: { intent: Record<string, any> }) {
  return (
    <View>
      <SectionTitle hint="What the intent agent extracted">Understanding</SectionTitle>
      <Card>
        <View className="flex-row flex-wrap gap-2 mb-2">
          <Badge tone="brand">{intent.service_label ?? intent.service_type}</Badge>
          <Badge tone={intent.urgency === "emergency" ? "danger" : intent.urgency === "high" ? "warn" : "default"}>
            {String(intent.time?.kind).replace("_", " ")} · {intent.urgency}
          </Badge>
          <Badge tone="default"><Text className="text-[11px] text-ink-muted">{intent.location?.area ?? intent.location?.city ?? intent.location?.raw}</Text></Badge>
          <Badge tone="accent">complexity: {intent.complexity_hint}</Badge>
          <Badge tone={intent.price_sensitivity === "high" ? "warn" : "default"}>
            price: {intent.price_sensitivity}
          </Badge>
        </View>
        <Text className="text-[11px] text-ink-dim">confidence {Number(intent.confidence).toFixed(2)} · {(intent.detected_languages ?? []).join(" · ")}</Text>
        <Text className="text-sm text-ink-muted italic mt-2">{intent.rationale}</Text>
      </Card>
    </View>
  );
}
