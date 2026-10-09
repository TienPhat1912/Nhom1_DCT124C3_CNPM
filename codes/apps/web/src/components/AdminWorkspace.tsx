import { ConfigurationEditor } from './ConfigurationEditor';
import { getDictionary, type Language } from '../../../../packages/i18n/src/index';

export function AdminWorkspace({lang}:{lang:Language}) {
  return <section className="card" id="admin-workspace"><h2>{getDictionary(lang).staff.adminTitle}</h2><ConfigurationEditor lang={lang}/></section>;
}
