import { useState } from "react";
import { Modal, ScrollView, View } from "react-native";
import { languages, translator, type Locale } from "@hospital/shared";
import { Btn, Choice, Txt, colors } from "./ui";

export function LanguagePicker({
  locale,
  onChange,
}: {
  locale: Locale;
  onChange: (language: Locale) => void;
}) {
  const [open, setOpen] = useState(false);
  const t = translator(locale);
  return (
    <>
      <Btn secondary onPress={() => setOpen(true)}>
        {languages.find((l) => l.code === locale)?.label ?? t("language")}
      </Btn>
      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            padding: 24,
            backgroundColor: "#0008",
          }}
        >
          <View
            style={{
              maxHeight: "85%",
              padding: 20,
              borderRadius: 20,
              backgroundColor: colors.paper,
            }}
          >
            <Txt tone="heading">{t("language")}</Txt>
            <ScrollView>
              {languages.map((l) => (
                <Choice
                  key={l.code}
                  label={l.label}
                  selected={locale === l.code}
                  onPress={() => {
                    onChange(l.code);
                    setOpen(false);
                  }}
                />
              ))}
            </ScrollView>
            <Btn secondary onPress={() => setOpen(false)}>
              {t("close")}
            </Btn>
          </View>
        </View>
      </Modal>
    </>
  );
}
