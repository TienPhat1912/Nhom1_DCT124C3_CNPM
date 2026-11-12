-- PB-002: legacy schema only. No migration, DML, temp tables or application startup.
SET NOCOUNT ON;
SET XACT_ABORT ON;
SET LOCK_TIMEOUT 15000;
SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;
BEGIN TRANSACTION;
WITH steps AS (
 SELECT s.*, j.VisitId FROM dbo.JourneyStep s
 JOIN dbo.PatientJourney j ON j.Id = s.PatientJourneyId
), outstanding AS (
 SELECT PatientId, Id FROM dbo.Visits WHERE Status = 'Active'
 UNION ALL SELECT PatientId, Id FROM dbo.Requests WHERE Status IN ('Submitted','NeedsInformation')
), findings AS (
 SELECT 'patient_multiple_open_records' AS [Rule], o.PatientId AS EntityId, o.Id AS RelatedId,
 COUNT_BIG(*) OVER (PARTITION BY o.PatientId) AS RecordCount FROM outstanding o
 UNION ALL
 SELECT 'room_multiple_consultations', s.LocationId, s.VisitId,
 COUNT_BIG(*) OVER (PARTITION BY s.LocationId)
 FROM (SELECT DISTINCT LocationId, VisitId FROM steps
 WHERE Kind IN ('Consultation','ReturnConsultation') AND Status = 'InProgress') s
 JOIN dbo.Visits v ON v.Id = s.VisitId AND v.Status = 'Active'
 UNION ALL
 SELECT 'visit_multiple_open_orders', VisitId, Id, COUNT_BIG(*) OVER (PARTITION BY VisitId)
 FROM dbo.DoctorOrder WHERE Status NOT IN ('Resolved','Completed','Cancelled','Skipped')
 UNION ALL
 SELECT 'doctor_room_unconfirmed', Id, Id, 1 FROM dbo.Users WHERE Role = 'Doctor' AND Active = 1
 UNION ALL
 SELECT 'doctor_multiple_observed_rooms', v.DoctorId, s.LocationId,
 COUNT_BIG(*) OVER (PARTITION BY v.DoctorId)
 FROM (SELECT DISTINCT VisitId, LocationId FROM steps WHERE Kind IN ('Consultation','ReturnConsultation')) s
 JOIN dbo.Visits v ON v.Id = s.VisitId AND v.Status = 'Active'
 GROUP BY v.DoctorId, s.LocationId
 UNION ALL
 SELECT 'pending_activation', VisitId, Id, 1 FROM dbo.PatientJourney WHERE Status = 'PendingActivation'
 UNION ALL
 SELECT 'settlement_requires_review', Id, Id, 1 FROM dbo.Visits
 WHERE FinalSettlementRevision IS NOT NULL OR FinalSettlementOutcome IS NOT NULL
 UNION ALL
 SELECT 'settlement_before_clinical_resolution', v.Id, v.Id, 1 FROM dbo.Visits v
 WHERE (v.FinalSettlementRevision IS NOT NULL OR v.FinalSettlementOutcome IS NOT NULL)
 AND (v.FinalSettlementRevision <> v.WorkRevision OR EXISTS
 (SELECT 1 FROM steps s WHERE s.VisitId = v.Id AND s.Kind IN ('Consultation','ReturnConsultation','Service') AND s.Status <> 'Completed'))
 UNION ALL
 SELECT 'skipped_cancelled_step', VisitId, Id, 1 FROM steps WHERE Status IN ('Skipped','Cancelled')
 UNION ALL
 SELECT 'skipped_cancelled_order', VisitId, Id, 1 FROM dbo.DoctorOrder WHERE Status IN ('Skipped','Cancelled')
 UNION ALL
 SELECT 'published_summary_requires_review', VisitId, Id, 1 FROM dbo.SummaryVersion WHERE Status = 'Published'
 UNION ALL
 SELECT 'published_followup_requires_review', VisitId, Id, 1 FROM dbo.FollowUpRecommendation WHERE Status = 'Published'
 UNION ALL
 SELECT 'open_pharmacy', VisitId, Id, 1 FROM steps WHERE Kind = 'Pharmacy' AND Status NOT IN ('Completed','Skipped','Cancelled')
 UNION ALL
 SELECT 'ticket_snapshot_missing_legacy', v.Id, t.Id, 1 FROM dbo.Visits v
 LEFT JOIN dbo.ExaminationTicket t ON t.VisitId = v.Id
 UNION ALL
 SELECT 'ticket_number_missing', v.Id, t.Id, 1 FROM dbo.Visits v
 LEFT JOIN dbo.ExaminationTicket t ON t.VisitId = v.Id WHERE t.Id IS NULL OR NULLIF(LTRIM(RTRIM(t.Number)), '') IS NULL
 UNION ALL
 SELECT 'destination_snapshot_incomplete', VisitId, Id, 1 FROM steps
 WHERE ISJSON(DestinationSnapshot) <> 1
 OR TRY_CONVERT(uniqueidentifier, JSON_VALUE(CASE WHEN ISJSON(DestinationSnapshot) = 1 THEN DestinationSnapshot ELSE '{}' END, '$.id')) IS NULL
 OR TRY_CONVERT(uniqueidentifier, JSON_VALUE(CASE WHEN ISJSON(DestinationSnapshot) = 1 THEN DestinationSnapshot ELSE '{}' END, '$.id')) <> LocationId
 OR EXISTS (SELECT 1 FROM (VALUES ('$.nameVi'),('$.building'),('$.floor'),('$.room')) p(path)
 WHERE NULLIF(LTRIM(RTRIM(JSON_VALUE(CASE WHEN ISJSON(DestinationSnapshot) = 1 THEN DestinationSnapshot ELSE '{}' END, p.path))), '') IS NULL)
 UNION ALL
 SELECT 'visit_clinic_ambiguous', v.Id, v.Id, 1 FROM dbo.Visits v
 WHERE (SELECT COUNT(DISTINCT LocationId) FROM steps s WHERE s.VisitId = v.Id AND s.Kind IN ('Consultation','ReturnConsultation')) <> 1
 UNION ALL
 SELECT 'guest_link_history', Id, VisitId, 1 FROM dbo.AuditEvent WHERE Type = 'GuestLinked'
 UNION ALL
 SELECT 'legacy_patient_locale', Id, Id, 1 FROM dbo.Patients WHERE Language IN ('ko','ru')
)
SELECT [Rule], CONVERT(varchar(36), EntityId) AS EntityId,
 COALESCE(CONVERT(varchar(36), RelatedId), '-') AS RelatedId, RecordCount
FROM findings
WHERE [Rule] NOT IN ('patient_multiple_open_records','room_multiple_consultations','visit_multiple_open_orders','doctor_multiple_observed_rooms') OR RecordCount > 1
ORDER BY [Rule], EntityId, RelatedId;
ROLLBACK TRANSACTION;

