// Shows a text blast's template lines ("Label: value") with the style the investigator picked —
// used by the notification list (Header.jsx) and the Text Blast page's preview, so the sender sees
// exactly what recipients get. The email version is textBlastFieldsHtml in lib/email.js.
const STYLE_CLASSES = {
  blue: 'text-blue-700',
  highlight: 'bg-yellow-200 text-gray-900 rounded px-1 -mx-1',
};

export default function TextBlastFields({ fields, className = '' }) {
  if (!fields?.length) return null;
  return (
    <dl className={`space-y-0.5 text-sm ${className}`}>
      {fields.map((field, index) => (
        <div key={index} className={`break-words ${STYLE_CLASSES[field.style] || 'text-gray-700'}`}>
          <dt className="inline font-semibold">{field.label}:</dt>{' '}
          <dd className="inline">{field.value}</dd>
        </div>
      ))}
    </dl>
  );
}
