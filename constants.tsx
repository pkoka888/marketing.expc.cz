import React from 'react';
import { 
  MousePointer2, 
  BarChart3, 
  Search, 
  Globe,
  Tag,
  PieChart
} from 'lucide-react';
import { InstructionItem } from './types';

export const SHARED_EMAIL = 'pavel.kaspar@okamih.cz';

export const INSTRUCTIONS_DATA: (InstructionItem & { directLink?: string })[] = [
  {
    id: 'google-ads',
    title: 'Google Ads (Reklamy)',
    icon: <MousePointer2 className="w-5 h-5 text-blue-600" />,
    directLink: 'https://ads.google.com/aw/accountaccess/users',
    steps: [
      'Přihlaste se do Google Ads.',
      'Klikněte na "Nástroje a nastavení" (ikona klíče) v horním menu.',
      'V sekci "Nastavení" zvolte "Přístup a zabezpečení".',
      'Klikněte na modré tlačítko PLUS (+).',
      `Vložte email: ${SHARED_EMAIL}`,
      'Zvolte úroveň přístupu "SPRÁVCE" (Admin).',
      'Klikněte na "Odeslat pozvánku".'
    ]
  },
  {
    id: 'ga4',
    title: 'Google Analytics 4 (Měření)',
    icon: <BarChart3 className="w-5 h-5 text-orange-500" />,
    directLink: 'https://analytics.google.com/analytics/web/#/a87262364p254354354/admin/account/user-management',
    steps: [
      'V Analytics klikněte vlevo dole na ozubené kolo (Správce).',
      'V prvním sloupci (Účet) klikněte na "Správa přístupu k účtu".',
      'Klikněte na modré PLUS (+) vpravo nahoře a "Přidat uživatele".',
      `Zadejte email: ${SHARED_EMAIL}`,
      'Zaškrtněte roli "EDITOR" (nebo Administrátor pro plnou kontrolu).',
      'Klikněte na "Přidat".'
    ]
  },
  {
    id: 'gtm',
    title: 'Google Tag Manager (Měřící kódy)',
    icon: <Tag className="w-5 h-5 text-teal-600" />,
    directLink: 'https://tagmanager.google.com/#/admin/',
    steps: [
      'Otevřete GTM a přejděte do záložky "Správce" (Admin).',
      'V pravém sloupci (Kontejner) zvolte "Správa uživatelů".',
      'Klikněte na "Nový" (modré +) -> "Přidat uživatele".',
      `Vložte email: ${SHARED_EMAIL}`,
      'V "Oprávnění kontejneru" zaškrtněte vše (Publikovat, Schválit, Upravit, Číst).',
      'Klikněte na "Pozvat".'
    ]
  },
  {
    id: 'looker',
    title: 'Looker Studio (Reporty a grafy)',
    icon: <PieChart className="w-5 h-5 text-purple-600" />,
    directLink: 'https://lookerstudio.google.com/navigation/reporting',
    steps: [
      'Pokud již máte existující reporty, otevřete daný report.',
      'Vpravo nahoře klikněte na tlačítko "Sdílet".',
      `Přidejte email: ${SHARED_EMAIL}`,
      'Nastavte roli na "EDITOR".',
      'Klikněte na "Odeslat". (Tímto získáme přístup k vizualizaci vašich dat).'
    ]
  },
  {
    id: 'gsc',
    title: 'Google Search Console (SEO)',
    icon: <Search className="w-5 h-5 text-green-600" />,
    directLink: 'https://search.google.com/search-console/settings/users',
    steps: [
      'V menu vlevo sjeďte úplně dolů a klikněte na "Nastavení".',
      'Zvolte "Uživatelé a oprávnění".',
      'Klikněte na tlačítko "Přidat uživatele".',
      `Zadejte email: ${SHARED_EMAIL}`,
      'Oprávnění nastavte na "ÚPLNÉ" (Full).',
      'Potvrďte tlačítkem "Přidat".'
    ]
  },
  {
    id: 'meta',
    title: 'Meta (Facebook / Instagram Ads)',
    icon: <Globe className="w-5 h-5 text-indigo-600" />,
    directLink: 'https://business.facebook.com/settings/people',
    steps: [
      'Otevřete Nastavení firmy (Business Settings).',
      'V sekci "Uživatelé" -> "Lidé" klikněte na "Přidat".',
      `Vložte email: ${SHARED_EMAIL}`,
      'Povolte "Úplnou kontrolu" (Full Control / Admin access).',
      'V dalším kroku nám přiřaďte přístup k "Stránkám" a "Účtům pro reklamu".'
    ]
  }
];