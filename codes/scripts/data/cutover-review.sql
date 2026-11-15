-- PB-030, latest schema. Zero rows is necessary, but operator approval is still required.
-- Read-only; run with writes paused on the upgraded copy. IDs only.
SET NOCOUNT ON;
SET XACT_ABORT ON;
SET LOCK_TIMEOUT 15000;
SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;
BEGIN TRANSACTION;
WITH findings AS (
 SELECT 'active_visit_unverified' AS Reason, v.Id AS EntityId FROM Visits v
 WHERE v.Status = 'Active' AND (v.ClinicLocationId IS NULL OR v.ExamStatus IS NULL OR v.ConsultationCount IS NULL)
 UNION ALL
 SELECT 'active_ticket_unverified', v.Id FROM Visits v
 WHERE v.Status = 'Active' AND NOT EXISTS (SELECT 1 FROM ExaminationTicket t WHERE t.VisitId = v.Id
   AND t.SnapshotSource = 'Captured' AND t.ClinicLocationId = v.ClinicLocationId AND t.SequenceNumber IS NOT NULL)
 UNION ALL
 SELECT 'active_doctor_assignment_unverified', v.Id FROM Visits v
 WHERE v.Status = 'Active' AND NOT EXISTS (SELECT 1 FROM ClinicRoom r JOIN ClinicDoctor d
   ON d.ClinicLocationId = r.ClinicLocationId AND d.DoctorId = r.ActiveDoctorId
   JOIN Users u ON u.Id = d.DoctorId AND u.Active = 1 AND u.Role = 'Doctor'
   WHERE r.ClinicLocationId = v.ClinicLocationId AND r.ActiveDoctorId = v.DoctorId)
 UNION ALL
 SELECT 'room_multiple_consultations', s.LocationId FROM JourneyStep s JOIN PatientJourney j ON j.Id = s.PatientJourneyId
   JOIN Visits v ON v.Id = j.VisitId WHERE v.Status = 'Active'
   AND s.Kind IN ('Consultation','ReturnConsultation') AND s.Status = 'InProgress'
   GROUP BY s.LocationId HAVING COUNT(DISTINCT v.Id) > 1
 UNION ALL
 SELECT 'visit_multiple_open_orders', VisitId FROM DoctorOrder
   WHERE Status NOT IN ('Resolved','Completed','Cancelled','Skipped') GROUP BY VisitId HAVING COUNT(*) > 1
 UNION ALL
 SELECT 'legacy_open_order_unverified', Id FROM DoctorOrder WHERE ConsultationNumber IS NULL
   AND Status NOT IN ('Resolved','Completed','Cancelled','Skipped')
 UNION ALL
 SELECT 'patient_multiple_open_records', PatientId FROM (
   SELECT PatientId FROM Visits WHERE Status = 'Active'
   UNION ALL SELECT PatientId FROM Requests WHERE Status IN ('Submitted','NeedsInformation')
 ) o GROUP BY PatientId HAVING COUNT(*) > 1
 UNION ALL
 SELECT 'request_source_unknown', Id FROM Requests WHERE Status IN ('Submitted','NeedsInformation') AND SourceLanguage IS NULL
 UNION ALL
 SELECT 'assistance_source_unknown', Id FROM AssistanceRequest WHERE Status NOT IN ('Resolved','Closed','Cancelled') AND SourceLanguage IS NULL
 UNION ALL
 SELECT 'active_destination_unverified', s.Id FROM JourneyStep s JOIN PatientJourney j ON j.Id = s.PatientJourneyId
   JOIN Visits v ON v.Id = j.VisitId
   CROSS APPLY (SELECT CASE WHEN ISJSON(s.DestinationSnapshot) = 1 THEN s.DestinationSnapshot ELSE '{}' END AS Json) p
   WHERE v.Status = 'Active' AND (TRY_CONVERT(uniqueidentifier, JSON_VALUE(p.Json, '$.id')) IS NULL
     OR TRY_CONVERT(uniqueidentifier, JSON_VALUE(p.Json, '$.id')) <> s.LocationId
     OR EXISTS (SELECT 1 FROM (VALUES ('$.nameVi'),('$.building'),('$.floor'),('$.room')) f(path)
       WHERE NULLIF(LTRIM(RTRIM(JSON_VALUE(p.Json, f.path))), '') IS NULL))
)
SELECT Reason, EntityId, COUNT_BIG(*) OVER (PARTITION BY Reason) AS ReasonCount
FROM findings ORDER BY Reason, EntityId;
ROLLBACK TRANSACTION;
