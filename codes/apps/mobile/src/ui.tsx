import { localizeText } from "@hospital/shared";
import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type TextProps,
} from "react-native";
import {
  dateText,
  displayName,
  type Destination,
  type Locale,
} from "@hospital/shared";
import { localizedError, useNative } from "./runtime";
export const colors = {
  green: "#0a6357",
  dark: "#203d35",
  muted: "#647d71",
  line: "#dce7de",
  paper: "#ffffff",
  background: "#f3f7f3",
  pale: "#e7f1e8",
  error: "#a44638",
};
export function Txt({
  children,
  tone = "body",
  ...props
}: TextProps & { tone?: "body" | "title" | "heading" | "muted" | "eyebrow" }) {
  return (
    <Text
      {...props}
      allowFontScaling
      style={[
        styles.text,
        tone === "title" && styles.title,
        tone === "heading" && styles.heading,
        tone === "muted" && styles.muted,
        tone === "eyebrow" && styles.eyebrow,
        props.style,
      ]}
    >
      {children}
    </Text>
  );
}
export function Btn({
  children,
  onPress,
  secondary = false,
  disabled = false,
  busy = false,
}: {
  children: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
  busy?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={children}
      accessibilityState={{ disabled: disabled || busy, busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        secondary && styles.secondaryButton,
        (disabled || busy) && { opacity: 0.5 },
        pressed && { opacity: 0.8 },
      ]}
    >
      {busy && <ActivityIndicator color={secondary ? colors.green : "#fff"} />}
      <Text
        allowFontScaling
        style={[styles.buttonText, secondary && { color: colors.green }]}
      >
        {children}
      </Text>
    </Pressable>
  );
}
export function Card({ children }: { children: ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}
export function Input({
  label,
  hint,
  ...props
}: TextInputProps & { label: string; hint?: string }) {
  return (
    <View style={{ marginVertical: 9 }}>
      <Txt style={styles.label}>{label}</Txt>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor="#82948a"
        {...props}
        style={[
          styles.input,
          props.multiline && { minHeight: 90, textAlignVertical: "top" },
          props.style,
        ]}
      />
      {hint && <Txt tone="muted">{hint}</Txt>}
    </View>
  );
}
export function Choice({
  label,
  selected,
  onPress,
  disabled = false,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, disabled }}
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.choice,
        disabled && { opacity: 0.5 },
        selected && { backgroundColor: colors.pale, borderColor: colors.green },
      ]}
    >
      <Txt style={{ color: selected ? colors.green : colors.muted }}>
        {selected ? "● " : "○ "}
        {label}
      </Txt>
    </Pressable>
  );
}
export function Feedback({
  error,
  ok,
  locale,
}: {
  error?: unknown;
  ok?: boolean;
  locale: Locale;
}) {
  return error ? (
    <View accessibilityLiveRegion="polite" style={styles.error}>
      <Txt style={{ color: colors.error }}>{localizedError(error, locale)}</Txt>
    </View>
  ) : ok ? (
    <View accessibilityLiveRegion="polite" style={styles.success}>
      <Txt>{localizeText("Máy chủ đã xác nhận thao tác.", locale)}</Txt>
    </View>
  ) : null;
}
export function LoadingState({
  resource,
}: {
  resource: {
    data: unknown;
    error: unknown;
    loading: boolean;
    updatedAt?: string | null;
    refresh: () => void;
  };
}) {
  const { t, locale } = useNative();
  return (
    <>
      {resource.loading && !resource.data && (
        <ActivityIndicator
          color={colors.green}
          accessibilityLabel={t("loading")}
        />
      )}
      <Feedback error={resource.error} locale={locale} />
      {resource.error ? (
        <>
          {resource.data && (
            <Txt tone="muted">
              {t("stale")} · {dateText(resource.updatedAt, locale)}
            </Txt>
          )}
          <Btn secondary onPress={resource.refresh}>
            {t("retry")}
          </Btn>
        </>
      ) : null}
    </>
  );
}
export function Badge({ value }: { value: string }) {
  const { t } = useNative();
  return (
    <View style={styles.badge}>
      <Txt style={{ color: colors.green, fontSize: 12 }}>{t(value)}</Txt>
    </View>
  );
}
export function DestinationBlock({
  destination,
}: {
  destination: Destination;
}) {
  const { t, locale } = useNative();
  return (
    <View style={styles.destination}>
      <Txt tone="heading">{displayName(destination, locale)}</Txt>
      <Txt tone="muted">
        {t("building")} {destination.building} · {t("floor")}{" "}
        {destination.floor} · {t("room")} {destination.room}
      </Txt>
    </View>
  );
}
export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 18, paddingBottom: 40 },
  text: { color: colors.dark, fontSize: 15, lineHeight: 24 },
  title: { fontSize: 27, lineHeight: 36, fontWeight: "700", marginBottom: 12 },
  heading: { fontSize: 18, lineHeight: 27, fontWeight: "600", marginBottom: 8 },
  muted: { color: colors.muted, fontSize: 12, lineHeight: 20 },
  eyebrow: {
    color: colors.green,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.4,
    marginBottom: 8,
  },
  card: {
    backgroundColor: "white",
    borderRadius: 15,
    borderColor: colors.line,
    borderWidth: 1,
    padding: 20,
    marginBottom: 17,
    gap: 7,
  },
  button: {
    minHeight: 48,
    borderRadius: 9,
    backgroundColor: colors.green,
    padding: 13,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginVertical: 6,
  },
  buttonText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
  secondaryButton: {
    backgroundColor: "white",
    borderColor: colors.line,
    borderWidth: 1,
  },
  input: {
    borderWidth: 1,
    borderColor: "#c9d9ce",
    borderRadius: 8,
    backgroundColor: "white",
    padding: 12,
    minHeight: 47,
    color: colors.dark,
    fontSize: 15,
  },
  label: { fontSize: 13, marginBottom: 6, fontWeight: "500" },
  choice: {
    padding: 12,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    marginVertical: 4,
    minHeight: 46,
  },
  error: {
    padding: 13,
    backgroundColor: "#fff0e9",
    borderRadius: 9,
    marginVertical: 10,
  },
  success: {
    padding: 13,
    backgroundColor: colors.pale,
    borderRadius: 9,
    marginVertical: 10,
  },
  badge: {
    backgroundColor: colors.pale,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: "flex-start",
    marginVertical: 3,
  },
  destination: {
    padding: 15,
    backgroundColor: "#f0f6ef",
    borderRadius: 9,
    marginVertical: 12,
  },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" },
  divider: { height: 1, backgroundColor: colors.line, marginVertical: 15 },
  header: {
    padding: 16,
    paddingBottom: 10,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  bottom: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: "white",
    borderTopWidth: 1,
    borderTopColor: colors.line,
    padding: 7,
    gap: 3,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    minHeight: 48,
    alignItems: "center",
    borderRadius: 8,
  },
});
