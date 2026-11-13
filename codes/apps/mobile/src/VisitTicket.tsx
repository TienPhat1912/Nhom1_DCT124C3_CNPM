import { View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import {
  dateText,
  type ExaminationTicketV2,
  type Ticket,
} from "@hospital/shared";
import { Card, LoadingState, Txt } from "./ui";
import { useLoad, useNative, WEB_URL } from "./runtime";

export function VisitTicket({ id }: { id: string }) {
  const { t, locale } = useNative();
  const resource = useLoad<Ticket | ExaminationTicketV2>(
    `/api/visits/${id}/ticket`,
  );
  const ticket = resource.data;
  return (
    <Card>
      <LoadingState resource={resource} />
      {ticket &&
        ("patientSnapshot" in ticket ? (
          <>
            <Txt tone="heading">
              {t("ticket")}: {ticket.number}
            </Txt>
            <Txt>
              {ticket.patientSnapshot.name} · {ticket.patientSnapshot.contact}
            </Txt>
            <Txt>
              {ticket.clinicSnapshot.nameVi} · {t("room")}{" "}
              {ticket.clinicSnapshot.room}
            </Txt>
            <Txt>
              {ticket.clinicSnapshot.building} · {ticket.clinicSnapshot.floor}
            </Txt>
            <Txt>
              {t("doctor")}: {ticket.doctorSnapshot.name}
            </Txt>
            <Txt>
              {ticket.issuedOn} · {ticket.number}
            </Txt>
          </>
        ) : (
          <>
            <Txt tone="heading">{ticket.number}</Txt>
            <View style={{ alignItems: "center", padding: 15 }}>
              <QRCode value={`${WEB_URL}/#ticket=${ticket.code}`} size={180} />
            </View>
            <Txt tone="muted">
              {t("ticketHint")} · {dateText(ticket.expiresAt, locale)}
            </Txt>
          </>
        ))}
    </Card>
  );
}
