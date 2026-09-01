-- CreateIndex
CREATE INDEX "annotations_reportId_idx" ON "annotations"("reportId");

-- CreateIndex
CREATE INDEX "annotations_authorId_idx" ON "annotations"("authorId");

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_reportId_idx" ON "audit_logs"("reportId");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "daily_report_entries_municipalityId_idx" ON "daily_report_entries"("municipalityId");

-- CreateIndex
CREATE INDEX "daily_report_entries_reportDate_idx" ON "daily_report_entries"("reportDate");

-- CreateIndex
CREATE INDEX "incidents_municipalityId_idx" ON "incidents"("municipalityId");

-- CreateIndex
CREATE INDEX "incidents_createdById_idx" ON "incidents"("createdById");

-- CreateIndex
CREATE INDEX "incidents_generalCategory_idx" ON "incidents"("generalCategory");

-- CreateIndex
CREATE INDEX "incidents_dateOfIncident_idx" ON "incidents"("dateOfIncident");

-- CreateIndex
CREATE INDEX "notifications_userId_createdAt_idx" ON "notifications"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "notifications_reportId_idx" ON "notifications"("reportId");

-- CreateIndex
CREATE INDEX "reports_submittedById_idx" ON "reports"("submittedById");

-- CreateIndex
CREATE INDEX "reports_passedToId_idx" ON "reports"("passedToId");

-- CreateIndex
CREATE INDEX "reports_passedToRole_idx" ON "reports"("passedToRole");

-- CreateIndex
CREATE INDEX "reports_reviewedById_idx" ON "reports"("reviewedById");

-- CreateIndex
CREATE INDEX "reports_municipalityId_idx" ON "reports"("municipalityId");

-- CreateIndex
CREATE INDEX "reports_incidentId_idx" ON "reports"("incidentId");

-- CreateIndex
CREATE INDEX "reports_status_idx" ON "reports"("status");

-- CreateIndex
CREATE INDEX "reports_category_idx" ON "reports"("category");

-- CreateIndex
CREATE INDEX "reports_reportType_reportDate_idx" ON "reports"("reportType", "reportDate");

-- CreateIndex
CREATE INDEX "users_role_municipalityId_idx" ON "users"("role", "municipalityId");
