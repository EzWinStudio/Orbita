import type { TranslationKey } from '../core';

export type TranslationRow = readonly [
  TranslationKey,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
];

// Columns: de, es, fr, pt, ru, ar, zh, ja
export const studioRows: readonly TranslationRow[] = [
  ["Bağlantılar", "Verbindungen", "Conexiones", "Connexions", "Ligações", "Подключения", "الاتصالات", "连接", "接続"],
  ["Çeviri", "Übersetzung", "Traducción", "Traduction", "Tradução", "Перевод", "الترجمة", "翻译", "翻訳"],
  ["Güncellemeler", "Aktualisierungen", "Actualizaciones", "Mises à jour", "Atualizações", "Обновления", "التحديثات", "更新", "更新"],
  ["Kilitle", "Sperren", "Bloquear", "Verrouiller", "Bloquear", "Заблокировать", "قفل", "锁定", "ロック"],
  ["Hesabı kilitle", "Konto sperren", "Bloquear cuenta", "Verrouiller le compte", "Bloquear conta", "Заблокировать аккаунт", "قفل الحساب", "锁定账户", "アカウントをロック"],
  ["Asistan", "Assistent", "Asistente", "Assistant", "Assistente", "Ассистент", "المساعد", "助手", "アシスタント"],
  ["Hesap", "Konto", "Cuenta", "Compte", "Conta", "Аккаунт", "الحساب", "账户", "アカウント"],
  ["Yerel komutlar · genel sorular", "Lokale Befehle · allgemeine Fragen", "Comandos locales · preguntas generales", "Commandes locales · questions générales", "Comandos locais · perguntas gerais", "Локальные команды · общие вопросы", "أوامر محلية · أسئلة عامة", "本地命令 · 一般问题", "ローカルコマンド · 一般的な質問"],
  ["Profil · güvenlik · şifre", "Profil · Sicherheit · Passwort", "Perfil · seguridad · contraseña", "Profil · sécurité · mot de passe", "Perfil · segurança · palavra-passe", "Профиль · безопасность · пароль", "الملف الشخصي · الأمان · كلمة المرور", "个人资料 · 安全 · 密码", "プロフィール · セキュリティ · パスワード"],
  ["Hesap eklendi. Doğrula ile erişimi kontrol et.", "Konto hinzugefügt. Mit Prüfen den Zugriff kontrollieren.", "Cuenta añadida. Usa Verificar para comprobar el acceso.", "Compte ajouté. Utilise Vérifier pour contrôler l accès.", "Conta adicionada. Usa Verificar para confirmar o acesso.", "Аккаунт добавлен. Нажми Проверить, чтобы проверить доступ.", "تمت إضافة الحساب. استخدم تحقق للتحقق من الوصول.", "账户已添加。使用验证检查访问权限。", "アカウントを追加しました。確認でアクセスを検証してください。"],
  ["Hesap eklendi; jeton gerçek API ile kontrol edildi.", "Konto hinzugefügt; Token wurde über die echte API geprüft.", "Cuenta añadida; el token se verificó con la API real.", "Compte ajouté ; le jeton a été vérifié via l'API réelle.", "Conta adicionada; o token foi verificado na API real.", "Аккаунт добавлен; токен проверен через реальный API.", "تمت إضافة الحساب؛ تم التحقق من الرمز عبر الواجهة الحقيقية.", "账户已添加；令牌已通过真实 API 验证。", "アカウントを追加しました。トークンは実際の API で検証されました。"],
  ["Bağlantı kaldırıldı.", "Verbindung entfernt.", "Conexión eliminada.", "Connexion supprimée.", "Ligação removida.", "Подключение удалено.", "تمت إزالة الاتصال.", "连接已移除。", "接続を削除しました。"],
  ["Parça listeden çıkarıldı.", "Titel aus der Liste entfernt.", "Pista quitada de la lista.", "Piste retirée de la liste.", "Faixa removida da lista.", "Трек удалён из списка.", "تمت إزالة المقطع من القائمة.", "曲目已从列表中移除。", "トラックをリストから削除しました。"],
  ["Güncelleme ayarları kaydedildi.", "Aktualisierungseinstellungen gespeichert.", "Ajustes de actualización guardados.", "Paramètres de mise à jour enregistrés.", "Definições de atualização guardadas.", "Настройки обновлений сохранены.", "تم حفظ إعدادات التحديث.", "更新设置已保存。", "更新設定を保存しました。"],
];
