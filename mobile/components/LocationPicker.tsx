import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from "react-native";
import { MapPin, X } from "lucide-react-native";
import { api, type PlacePrediction } from "@/lib/api";

export type PickedLocation = {
  place_id?: string;
  label: string;          // human-readable, populates the request "location"
  secondary?: string;
  lat?: number;
  lng?: number;
};

type Props = {
  value: PickedLocation | null;
  onChange: (loc: PickedLocation | null) => void;
  /** Optional center to bias autocomplete predictions. */
  biasLat?: number;
  biasLng?: number;
  placeholder?: string;
};

export function LocationPicker({ value, onChange, biasLat, biasLng, placeholder }: Props) {
  const [q, setQ] = useState("");
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [focused, setFocused] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastQueryRef = useRef("");

  useEffect(() => {
    if (!focused) return;
    if (!q.trim() || q.trim().length < 2) { setPredictions([]); return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const trimmed = q.trim();
      lastQueryRef.current = trimmed;
      setLoading(true);
      try {
        const r = await api.placesAutocomplete(trimmed, biasLat, biasLng);
        if (lastQueryRef.current === trimmed) setPredictions(r.predictions);
      } catch {
        setPredictions([]);
      } finally {
        setLoading(false);
      }
    }, 220);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [q, focused, biasLat, biasLng]);

  const display = useMemo(() => value?.label ?? q, [value, q]);

  async function pick(prediction: PlacePrediction) {
    setFocused(false);
    setPredictions([]);
    setResolving(true);
    try {
      const details = await api.placesDetails(prediction.place_id);
      onChange({
        place_id: details.place_id,
        label: prediction.main_text || details.name || prediction.full_text,
        secondary: prediction.secondary_text || details.address || undefined,
        lat: details.lat ?? undefined,
        lng: details.lng ?? undefined,
      });
      setQ("");
    } catch {
      // Fall back to the prediction's text if Details lookup fails.
      onChange({
        place_id: prediction.place_id,
        label: prediction.main_text || prediction.full_text,
        secondary: prediction.secondary_text || undefined,
      });
      setQ("");
    } finally {
      setResolving(false);
    }
  }

  function clear() {
    onChange(null);
    setQ("");
    setPredictions([]);
  }

  return (
    <View>
      <View className="flex-row items-center gap-2 bg-bg-soft border border-line rounded-xl px-3 py-2.5">
        <MapPin size={14} color="#a78bfa" />
        {value ? (
          <View className="flex-1">
            <Text className="text-sm text-ink" numberOfLines={1}>{value.label}</Text>
            {value.secondary ? (
              <Text className="text-[11px] text-ink-dim" numberOfLines={1}>{value.secondary}</Text>
            ) : null}
          </View>
        ) : (
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder={placeholder ?? "Search address (Powered by Google Places)"}
            placeholderTextColor="#71717a"
            className="flex-1 text-sm text-ink"
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 150)}
            autoCorrect={false}
          />
        )}
        {(loading || resolving) ? <ActivityIndicator size="small" color="#a78bfa" /> : null}
        {(value || q) && !resolving ? (
          <Pressable onPress={clear} hitSlop={8}>
            <X size={14} color="#71717a" />
          </Pressable>
        ) : null}
      </View>

      {focused && predictions.length > 0 ? (
        <View className="mt-2 bg-bg-elev/95 border border-line rounded-xl overflow-hidden">
          <FlatList
            data={predictions}
            keyExtractor={(p) => p.place_id}
            keyboardShouldPersistTaps="handled"
            ItemSeparatorComponent={() => <View className="h-px bg-line" />}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => pick(item)}
                className="px-3 py-2.5 active:bg-bg-soft flex-row items-start gap-2"
              >
                <MapPin size={12} color="#71717a" />
                <View className="flex-1">
                  <Text className="text-sm text-ink" numberOfLines={1}>{item.main_text}</Text>
                  {item.secondary_text ? (
                    <Text className="text-[11px] text-ink-dim" numberOfLines={1}>{item.secondary_text}</Text>
                  ) : null}
                </View>
              </Pressable>
            )}
          />
          <View className="px-3 py-1.5 border-t border-line bg-bg-soft">
            <Text className="text-[10px] text-ink-dim">Powered by Google Places</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}
