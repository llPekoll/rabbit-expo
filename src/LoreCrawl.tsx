/**
 * Le crawl d'ouverture, en natif.
 *
 * Porte de `src/components/lore-crawl.tsx` + `.rr-crawl-*` dans globals.css.
 * Les quatre reglages sont ceux qui SHIPPENT (story LoreCrawl, args de
 * `Default`), et ils ont chacun ete trouves contre un echec mesure :
 *
 *   perspective 420px — a 340px et 26deg il n'y avait aucune recession
 *                       visible ; a 240px et 52deg le chapitre se pliait en
 *                       une bande illisible au bord bas.
 *   tilt        38deg — le compromis du film : objectif long, convergence
 *                       douce, la typo y survit. NE PAS mettre a 0 : sans
 *                       rotation le crawl devient une boite de texte qui
 *                       monte (la story garde ce cas comme un ECHEC nomme).
 *   run         253vh — la distance parcourue en un passage.
 *   duree         64s — 253vh/64s = ~3,95vh/s : assez lent pour etre lu.
 *
 * Ces trois derniers sont UN SEUL reglage : en bouger un change la vitesse
 * de lecture.
 *
 * LE BOUT PROCHE EST GRAS. Dans le film la typo ne fait pas que grossir en
 * approchant, elle s'epaissit — et la face pixel du kit n'a qu'une graisse.
 * Le web peint donc le poids au `-webkit-text-stroke`, croissant par
 * paragraphe. React Native n'a pas de contour de glyphe : on approche avec
 * `textShadow`, qui epaissit le trait de la meme facon a l'oeil.
 */
import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { dict, type Locale } from './textes';

const PERSPECTIVE = 420;
const TILT = '38deg';
const RUN_VH = 2.53;      // 253vh
const DUREE_MS = 64_000;

/** L'identifiant du chapitre d'ouverture, cf. LORE[0] dans config/lore.ts. */
const OUVERTURE = 'the-island';

/** Le jaune couronne, `--crown` dans globals.css. */
const CROWN = '#ffd45c';

export function LoreCrawl({ locale }: { locale: Locale }) {
  const { height, width } = useWindowDimensions();
  const montee = useRef(new Animated.Value(0)).current;
  const t = dict(locale);
  const chapitre = (t.lore as any)[OUVERTURE];

  useEffect(() => {
    // Remise a zero a chaque changement de langue : un texte qui change au
    // milieu de sa course repartirait a un offset arbitraire.
    montee.setValue(0);
    const boucle = Animated.loop(
      Animated.timing(montee, {
        toValue: 1,
        duration: DUREE_MS,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    boucle.start();
    return () => boucle.stop();
  }, [montee, locale]);

  // Le texte part du bord bas (top: 100%) et monte de 253vh.
  const translateY = useMemo(
    () => montee.interpolate({
      inputRange: [0, 1],
      outputRange: [height, height - height * RUN_VH],
    }),
    [montee, height],
  );

  if (!chapitre) return null;

  // Plus large qu'il n'y parait : l'inclinaison resserre le bloc en
  // s'eloignant, donc une colonne calee a l'oeil devient un ruban au loin.
  const largeurTexte = Math.min(width * 0.96, 700);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Le ciel dans lequel le crawl monte, DERRIERE les mots. */}
      <LinearGradient
        colors={['#0d1117', 'rgba(13,17,23,0.92)', 'rgba(13,17,23,0)']}
        locations={[0, 0.4, 1]}
        style={styles.ciel}
        pointerEvents="none"
      />

      {/* La scene inclinee. L'origine en bas (`transform-origin: 50% 100%`)
          fait basculer le plan vers le fond, pas autour de son centre. */}
      <View style={styles.scene}>
        <Animated.View
          style={[
            styles.texte,
            {
              width: largeurTexte,
              transform: [
                { perspective: PERSPECTIVE },
                { rotateX: TILT },
                { translateY },
              ],
            },
          ]}
        >
          {/* Le bout LOIN : la chose la plus fine de l'ecran. */}
          <Text style={[styles.para, styles.episode]}>{t.codex.chapterN(1)}</Text>
          <Text style={[styles.para, styles.titre]}>{chapitre.title}</Text>
          {chapitre.body.map((p: string, i: number) => (
            <Text
              key={i}
              style={[
                styles.para,
                // Chaque paragraphe un peu plus gras que celui du dessus :
                // ils sont deja empiles dans l'ordre de lecture, donc le
                // dernier est le plus proche du lecteur.
                i >= 2 ? styles.grasFort : i === 1 ? styles.grasMoyen : styles.grasLeger,
              ]}
            >
              {p}
            </Text>
          ))}
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scene: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  texte: { position: 'absolute', top: 0 },
  para: {
    color: CROWN,
    fontSize: 15,
    lineHeight: 26,          // 1.75 comme le web
    textAlign: 'justify',
    marginBottom: 17,        // 1.1em
    // Le halo du web (`text-shadow: 0 0 12px`). En RN les trois proprietes
    // sont separees, et il n'y en a qu'une par Text : le poids croissant
    // plus bas remplace donc ce halo au lieu de s'y ajouter.
    textShadowColor: 'rgba(255, 212, 92, 0.28)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  episode: {
    fontSize: 12,
    letterSpacing: 2,
    textAlign: 'center',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  titre: { fontSize: 20, fontWeight: '700', textAlign: 'center', marginBottom: 14 },
  // Le poids, peint a l'ombre faute de contour de glyphe en RN.
  grasLeger: {
    textShadowColor: 'rgba(255,212,92,0.35)',
    textShadowRadius: 10,
  },
  grasMoyen: {
    textShadowColor: 'rgba(255,212,92,0.6)',
    textShadowRadius: 6,
  },
  grasFort: {
    textShadowColor: 'rgba(255,212,92,0.85)',
    textShadowRadius: 4,
  },
  ciel: { position: 'absolute', top: 0, left: 0, right: 0, height: '45%', zIndex: 1 },
});
