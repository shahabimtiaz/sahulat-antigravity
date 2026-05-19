import { ScrollView, Text, View, Pressable, Image } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Sparkles, ArrowRight, Brain, Languages, ShieldCheck, BarChart3, Clock3, Receipt, Wrench, Droplets, GraduationCap, Zap, Scissors } from "lucide-react-native";
import { Badge, Button, Card, SectionTitle } from "@/components/ui";

const SAMPLES = [
  { text: "AC bilkul kaam nahi kar raha, kal subah G-13 mein technician chahiye, budget zyada nahi hai.", label: "AC repair", Icon: Wrench },
  { text: "I need a female beautician for facial in F-7 tomorrow evening.", label: "Beauty", Icon: Scissors },
  { text: "Plumber chahiye abhi, bathroom mein leak hai I-8 ke andar.", label: "Emergency", Icon: Droplets },
  { text: "Bijli ka switch jal gaya hai Gulberg Lahore mein, urgent.", label: "Electrical", Icon: Zap },
  { text: "Math tutor for O-Level, Cantt area, twice a week.", label: "Tutor", Icon: GraduationCap },
];

export default function Home() {
  const router = useRouter();
  const params = useLocalSearchParams<{ apiBase?: string }>();
  const routeParams = params.apiBase ? { apiBase: params.apiBase } : undefined;
  return (
    <SafeAreaView className="flex-1 bg-bg" edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 20, paddingBottom: 32 }}>
        <View className="flex-row items-center gap-2">
          <View className="size-9 rounded-xl bg-brand/15 items-center justify-center border border-brand/30 overflow-hidden">
            <Image source={require("../assets/icon.png")} className="w-full h-full" resizeMode="contain" />
          </View>
          <Text className="text-base font-semibold text-ink">Sahulat</Text>
          <View className="ml-auto"><Badge tone="brand">Antigravity-Native</Badge></View>
        </View>

        <View className="gap-3">
          <Text className="text-3xl font-semibold tracking-tight text-ink leading-tight">
            Book a trusted home-service pro
          </Text>
          <Text className="text-base text-ink-muted">
            Urdu, English, or mixed. A multi-agent orchestrator handles intent, matching, pricing, and
            scheduling — with reasoning traces you can audit.
          </Text>
        </View>

        <View className="flex-row flex-wrap gap-2">
          <Badge tone="default"><Text className="text-[11px] text-ink-muted">Urdu · Roman Urdu · English</Text></Badge>
          <Badge tone="default"><Text className="text-[11px] text-ink-muted">11-factor matching</Text></Badge>
          <Badge tone="default"><Text className="text-[11px] text-ink-muted">Transparent pricing</Text></Badge>
        </View>

        <Button onPress={() => router.push({ pathname: "/request", params: routeParams })} size="lg">
          <Text className="text-white font-medium">Start a request</Text>
          <ArrowRight size={16} color="#fff" />
        </Button>

        <View className="flex-row gap-2">
          <Button onPress={() => router.push("/agents")} variant="secondary" size="md" className="flex-1">
            <Brain size={14} color="#f5f5f7" />
            <Text className="text-ink text-sm font-medium">Agent Manager</Text>
          </Button>
          <Button onPress={() => router.push("/provider-dashboard")} variant="ghost" size="md" className="flex-1">
            <BarChart3 size={14} color="#f5f5f7" />
            <Text className="text-ink text-sm font-medium">Provider</Text>
          </Button>
        </View>

        <Card className="p-0 overflow-hidden">
          <View className="bg-bg-soft px-4 py-3 border-b border-line">
            <View className="flex-row items-center gap-2">
              <Sparkles size={15} color="#34d399" />
              <Text className="text-ink font-medium">Today’s demo loop</Text>
              <Badge tone="accent">live</Badge>
            </View>
          </View>
          <View className="flex-row flex-wrap">
            {[
              { label: "Parse", value: "0.95", Icon: Languages },
              { label: "Rank", value: "11 factors", Icon: Brain },
              { label: "Slot", value: "buffered", Icon: Clock3 },
              { label: "Quote", value: "itemized", Icon: Receipt },
            ].map(({ label, value, Icon }) => (
              <View key={label} className="w-1/2 px-4 py-3 border-r border-b border-line">
                <Icon size={14} color="#a1a1aa" />
                <Text className="text-[10px] uppercase text-ink-dim mt-1">{label}</Text>
                <Text className="text-sm text-ink font-medium">{value}</Text>
              </View>
            ))}
          </View>
        </Card>

        <View>
          <SectionTitle hint="Tap to autofill">Try saying</SectionTitle>
          <View className="gap-2">
            {SAMPLES.map(({ text, label, Icon }) => (
              <Pressable
                key={text}
                onPress={() => router.push({ pathname: "/request", params: { q: text, ...(routeParams ?? {}) } })}
                className="bg-bg-elev border border-line rounded-xl px-4 py-3 active:bg-bg-soft"
              >
                <View className="flex-row items-start gap-3">
                  <View className="size-8 rounded-lg bg-brand/10 border border-brand/20 items-center justify-center">
                    <Icon size={14} color="#a78bfa" />
                  </View>
                  <View className="flex-1">
                    <Badge tone="default">{label}</Badge>
                    <Text className="text-sm text-ink mt-1">{text}</Text>
                  </View>
                  <ArrowRight size={15} color="#71717a" />
                </View>
              </Pressable>
            ))}
          </View>
        </View>

        <View className="gap-3">
          <SectionTitle>Why Sahulat</SectionTitle>
          {[
            { title: "Intent → multi-language", body: "Roman Urdu, Urdu, English, code-switching parsed with a confidence score.", Icon: Languages },
            { title: "11-factor matching", body: "Travel, availability, rating, on-time, specialization, price fit, capacity, cancellation, risk + more.", Icon: Brain },
            { title: "Audit-grade traces", body: "Every decision becomes an Antigravity-style artifact you can review.", Icon: ShieldCheck },
          ].map(({ title, body, Icon }) => (
            <Card key={title}>
              <View className="flex-row items-center gap-2 mb-1">
                <Icon size={16} color="#a78bfa" />
                <Text className="text-ink font-medium">{title}</Text>
              </View>
              <Text className="text-sm text-ink-muted">{body}</Text>
            </Card>
          ))}
        </View>

        <Text className="text-center text-[11px] text-ink-dim mt-4">
          Built with Google Antigravity skills · Gemini 2.5 · Supabase · Google Places API
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
