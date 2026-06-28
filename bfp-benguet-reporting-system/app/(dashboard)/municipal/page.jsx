'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import Link from 'next/link';
import StatusBadge from '@/components/common/StatusBadge';
import { formatDateTime } from '@/lib/utils';

export default function MunicipalDashboard() {
  const [user, setUser] = useState(null);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState(null);
  const [reportDetail, setReportDetail] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      setUser(JSON.parse(userData));
    }
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/reports', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setReports(response.data.reports);
    } catch (error) {
      console.error('Error fetching reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const openView = async (report) => {
    setSelectedReport(report);
    setShowPreview(false);
    setPreviewUrl(null);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`/api/reports/${report.id}`, { headers: { Authorization: `Bearer ${token}` } });
      setReportDetail(res.data.report);
    } catch {
      setReportDetail(report);
    }
  };

  const closeView = () => {
    setSelectedReport(null);
    setReportDetail(null);
    setShowPreview(false);
    setPreviewUrl(null);
  };

  const parseAttachments = (attachments) => {
    if (!attachments) return [];
    try { return typeof attachments === 'string' ? JSON.parse(attachments) : attachments; }
    catch { return []; }
  };

  const parseContent = (content) => {
    if (!content) return {};
    try { return typeof content === 'string' ? JSON.parse(content) : content; }
    catch { return {}; }
  };

  return (
    <div className="p-8">
      {/* Welcome Section */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-bfp-navy mb-2">Welcome, {user?.name}</h1>
        <p className="text-gray-600">
          Municipality: <strong>{user?.municipality?.name}</strong>
        </p>
      </div>

      {/* Report View Modal */}
      {selectedReport && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-3xl max-h-screen overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b">
              <h2 className="text-2xl font-bold text-bfp-navy">Report Details</h2>
              <button onClick={closeView} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
            </div>

            <div className="p-6 space-y-6">
              {/* Meta */}
              <div className="grid grid-cols-2 gap-4 bg-gray-50 rounded-lg p-4 text-sm">
                <div><p className="text-gray-500">Type</p><p className="font-semibold">{selectedReport.reportType}</p></div>
                <div><p className="text-gray-500">Status</p><StatusBadge status={selectedReport.status} /></div>
                <div><p className="text-gray-500">Report Date</p><p className="font-semibold">{new Date(selectedReport.reportDate).toLocaleDateString()}</p></div>
                <div><p className="text-gray-500">Submitted At</p><p className="font-semibold">{formatDateTime(selectedReport.submittedAt)}</p></div>
                {(reportDetail?.respondingOfficer || selectedReport.respondingOfficer) && (
                  <div><p className="text-gray-500">Reporting Officer</p><p className="font-semibold">{reportDetail?.respondingOfficer || selectedReport.respondingOfficer}</p></div>
                )}
                {(reportDetail?.passedToRole || selectedReport.passedToRole) && (
                  <div><p className="text-gray-500">Submitted To</p><p className="font-semibold">{(reportDetail?.passedToRole || selectedReport.passedToRole).replace(/_/g, ' ')}</p></div>
                )}
              </div>

              {/* Report Content */}
              {Object.keys(parseContent(reportDetail?.content || selectedReport.content)).length > 0 && (
                <div className="bg-blue-50 rounded-lg p-4">
                  <h3 className="font-bold text-bfp-navy mb-3">Report Content</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {Object.entries(parseContent(reportDetail?.content || selectedReport.content)).map(([key, val]) => (
                      <div key={key}>
                        <p className="text-gray-500 capitalize">{key.replace(/([A-Z])/g, ' $1')}</p>
                        <p className="font-semibold">{String(val)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Attachments + Open Report */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-bold text-bfp-navy mb-3">Attachments</h3>
                {parseAttachments(reportDetail?.attachments || selectedReport.attachments).length > 0 ? (
                  <ul className="space-y-2 text-sm mb-3">
                    {parseAttachments(reportDetail?.attachments || selectedReport.attachments).map((a) => (
                      <li key={a.url}>
                        <a href={a.url} target="_blank" rel="noreferrer" className="text-bfp-red hover:underline">{a.name}</a>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-500 mb-3">No attachments uploaded.</p>
                )}
                <button
                  type="button"
                  onClick={() => {
                    const list = parseAttachments(reportDetail?.attachments || selectedReport.attachments);
                    setPreviewUrl(list[0]?.url || null);
                    setShowPreview(true);
                  }}
                  className="btn btn-primary"
                >
                  Open Report
                </button>
              </div>

              {/* Reviewer remarks (if returned) */}
              {(reportDetail?.remarks || selectedReport.remarks) && (
                <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
                  <p className="text-sm font-bold text-red-700 mb-1">Correction Comments from Reviewer</p>
                  <p className="text-sm text-red-700">{reportDetail?.remarks || selectedReport.remarks}</p>
                </div>
              )}

              {/* Preview panel */}
              {showPreview && (
                <div className="bg-white border rounded p-3">
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="font-semibold">File Preview</h4>
                    <button className="text-sm text-gray-500 hover:text-gray-700" onClick={() => setShowPreview(false)}>Close</button>
                  </div>
                  {previewUrl ? (
                    <div className="w-full" style={{ height: 420 }}>
                      {previewUrl.match(/\.(pdf)$/i) ? (
                        <iframe title="preview" src={previewUrl} className="w-full h-full" />
                      ) : previewUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                        <img src={previewUrl} alt="attachment" className="w-full h-full object-contain" />
                      ) : (
                        <p className="p-4 text-gray-600">Cannot preview this file type. <a href={previewUrl} target="_blank" rel="noreferrer" className="text-bfp-red hover:underline">Download instead</a>.</p>
                      )}
                    </div>
                  ) : (
                    <p className="p-4 text-gray-500">No attachment to preview.</p>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 p-6 border-t bg-gray-50">
              {selectedReport.status === 'RETURNED' && (
                <Link href={`/municipal/reports/${selectedReport.id}/edit`} className="btn btn-danger">
                  ↩ Revise & Resubmit
                </Link>
              )}
              <button onClick={closeView} className="btn btn-secondary">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Action Cards */}
      <div className="flex flex-col items-center gap-6 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 w-full max-w-6xl mx-auto">
          <Link
            href="/municipal/reports/mdfir"
            className="card hover:shadow-lg transition-shadow cursor-pointer text-center"
          >
            <div className="text-4xl mb-2">📝</div>
            <h3 className="text-xl font-bold text-bfp-navy mb-2">MDFIR</h3>
            <p className="text-gray-600 mb-4">
              Submit a minimal damage fire incident report
            </p>
            <button className="btn btn-primary w-full">Submit Report →</button>
          </Link>

          <Link
            href="/municipal/reports/spot"
            className="card hover:shadow-lg transition-shadow cursor-pointer text-center"
          >
            <div className="text-4xl mb-2">🔍</div>
            <h3 className="text-xl font-bold text-bfp-navy mb-2">Spot Investigation</h3>
            <p className="text-gray-600 mb-4">
              Submit an on-site spot investigation report
            </p>
            <button className="btn btn-primary w-full">Submit Report →</button>
          </Link>

          <Link
            href="/municipal/reports/progress"
            className="card hover:shadow-lg transition-shadow cursor-pointer text-center"
          >
            <div className="text-4xl mb-2">⏳</div>
            <h3 className="text-xl font-bold text-bfp-navy mb-2">Progress Investigation</h3>
            <p className="text-gray-600 mb-4">
              Update an ongoing fire investigation report
            </p>
            <button className="btn btn-primary w-full">Submit Report →</button>
          </Link>

          <Link
            href="/municipal/reports/final"
            className="card hover:shadow-lg transition-shadow cursor-pointer text-center"
          >
            <div className="text-4xl mb-2">✅</div>
            <h3 className="text-xl font-bold text-bfp-navy mb-2">Final Investigation</h3>
            <p className="text-gray-600 mb-4">
              Submit the completed final investigation report
            </p>
            <button className="btn btn-primary w-full">Submit Report →</button>
          </Link>
        </div>
      </div>

      {/* My Reports Section */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold text-bfp-navy mb-4">My Submitted Reports</h2>

        {loading ? (
          <p className="text-gray-600">Loading reports...</p>
        ) : reports.length === 0 ? (
          <p className="text-gray-600">No reports submitted yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Report Type</th>
                  <th>Report Date</th>
                  <th>Status</th>
                  <th>Submitted At</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {reports.slice(0, 10).map((report) => (
                  <tr key={report.id}>
                    <td className="font-semibold">{report.reportType}</td>
                    <td>{new Date(report.reportDate).toLocaleDateString()}</td>
                    <td>
                      <StatusBadge status={report.status} />
                    </td>
                    <td className="text-sm">
                      {formatDateTime(report.submittedAt)}
                    </td>
                    <td>
                      <div className="flex gap-2 items-center">
                        <button
                          onClick={() => openView(report)}
                          className="btn btn-primary text-sm py-1 px-3"
                        >
                          View
                        </button>
                        {report.status === 'RETURNED' && (
                          <Link href={`/municipal/reports/${report.id}/edit`} className="btn btn-danger text-sm py-1 px-3">
                            Revise
                          </Link>
                        )}
                      </div>
                      {report.status === 'RETURNED' && report.remarks && (
                        <p className="text-xs text-red-600 mt-1 max-w-xs truncate" title={report.remarks}>⚠ {report.remarks}</p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {reports.length > 10 && (
          <div className="mt-4">
            <Link
              href="/municipal/reports"
              className="text-bfp-red hover:underline font-semibold"
            >
              View All Reports ({reports.length})
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
