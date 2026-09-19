/**
 * Le choix de la langue, sur la porte d'entree.
 *
 * Porte de `src/components/language-select.tsx`. Il appartient a cet ecran et
 * a lui seul : quelqu'un qui ne lit pas l'interface doit pouvoir y remedier
 * AVANT qu'on lui demande un wallet. Une fois choisi, le choix est retenu, et
 * un picker dans le jeu en marche serait un controle que personne ne touche
 * deux fois.
 *
 * LE DRAPEAU EST L'ETIQUETTE, et le nom de la langue est ecrit DANS cette
 * langue — "Francais", jamais "French". Un picker qui nomme les langues dans
 * la langue que le joueur ne lit pas est ecrit pour le developpeur.
 *
 * Quatre langues tiennent sur une ligne : on les pose cote a cote plutot que
 * dans un menu. Le web ouvre un <select> natif parce qu'il en a un ; ici un
 * menu modal pour quatre entrees serait un ecran de plus a traverser.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LOCALE_LIST } from '../jeu/src/i18n/locales';

import type { Locale } from './textes';

export function LanguePicker({
  locale, onChange,
}: {
  locale: Locale;
  onChange: (l: Locale) => void;
}) {
  return (
    <View style={styles.rangee}>
      {LOCALE_LIST.map((m) => {
        const actif = m.code === locale;
        return (
          <Pressable
            key={m.code}
            onPress={() => onChange(m.code)}
            style={({ pressed }) => [
              styles.puce,
              actif && styles.puceActive,
              pressed && styles.pucePressee,
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected: actif }}
            accessibilityLabel={m.label}
          >
            <Text style={styles.drapeau}>{m.flag}</Text>
            <Text style={[styles.nom, actif && styles.nomActif]}>{m.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  rangee: { flexDirection: 'row', justifyContent: 'center', gap: 6, flexWrap: 'wrap' },
  puce: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingVertical: 6, paddingHorizontal: 10,
    backgroundColor: '#161b22', borderRadius: 3,
    borderWidth: 1, borderColor: 'transparent',
  },
  puceActive: { borderColor: '#ff8c42', backgroundColor: '#1b2129' },
  pucePressee: { opacity: 0.7 },
  // Le drapeau est un emoji : dessine par la police systeme, jamais par
  // l'atlas du kit, donc sur en toutes langues.
  drapeau: { fontSize: 14 },
  nom: { color: '#8b949e', fontSize: 11, fontWeight: '600' },
  nomActif: { color: '#e6edf3' },
});
