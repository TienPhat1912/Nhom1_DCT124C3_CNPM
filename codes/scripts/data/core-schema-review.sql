-- PB-004 post-migration review. Explicit database is required by sqlcmd -d.
-- IDs/counts only; no descriptions, names, credentials or snapshot text.
SET NOCOUNT ON;
SET XACT_ABORT ON;
SET LOCK_TIMEOUT 15000;
SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;
BEGIN TRANSACTION;
WITH findings AS (
    SELECT 'visit_clinic_unresolved' AS Reason, Id AS EntityId FROM Visits WHERE ClinicLocationId IS NULL
    UNION ALL SELECT 'visit_exam_unverified', Id FROM Visits WHERE ExamStatus IS NULL OR ConsultationCount IS NULL
    UNION ALL SELECT 'ticket_snapshot_missing', Id FROM ExaminationTicket WHERE SnapshotSource = 'LegacyMissing'
    UNION ALL SELECT 'visit_ticket_missing', v.Id FROM Visits v WHERE NOT EXISTS (SELECT 1 FROM ExaminationTicket t WHERE t.VisitId = v.Id)
    UNION ALL SELECT 'request_source_unknown', Id FROM Requests WHERE SourceLanguage IS NULL
    UNION ALL SELECT 'assistance_source_unknown', Id FROM AssistanceRequest WHERE SourceLanguage IS NULL
    UNION ALL SELECT 'doctor_assignment_unconfirmed', u.Id FROM Users u WHERE Role = 'Doctor' AND Active = 1
        AND NOT EXISTS (SELECT 1 FROM ClinicDoctor d WHERE d.DoctorId = u.Id)
    UNION ALL SELECT 'clinic_active_doctor_missing', Id FROM ClinicRoom WHERE ActiveDoctorId IS NULL
)
SELECT Reason, EntityId, COUNT_BIG(*) OVER (PARTITION BY Reason) AS ReasonCount
FROM findings ORDER BY Reason, EntityId;
ROLLBACK TRANSACTION;
