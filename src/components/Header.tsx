import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { COLORS } from '../constants/theme';

interface HeaderProps {
  title: string;
  subtitle?: string;
  rightAction?: React.ReactNode;
  hideProfileAvatar?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  rightAction,
  hideProfileAvatar = false,
}) => {
  const router = useRouter();
  const { user } = useAuth();

  const userInitial = (user?.first?.[0] || user?.username?.[0] || 'U').toUpperCase();

  const profileAvatarButton = !hideProfileAvatar ? (
    <TouchableOpacity
      style={styles.avatarPill}
      onPress={() => router.push('/profile')}
      activeOpacity={0.8}
      accessibilityLabel="Open Profile"
    >
      <Text style={styles.avatarText}>{userInitial}</Text>
    </TouchableOpacity>
  ) : null;

  return (
    <View style={styles.container}>
      <View style={styles.textContainer}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      <View style={styles.rightContainer}>
        {rightAction ? <View style={styles.extraAction}>{rightAction}</View> : null}
        {profileAvatarButton}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: COLORS.bg,
  },
  textContainer: {
    flex: 1,
    marginRight: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: COLORS.text,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
    fontWeight: '500',
  },
  rightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  extraAction: {
    marginRight: 2,
  },
  avatarPill: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primaryLight,
    borderWidth: 2,
    borderColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  avatarText: {
    fontSize: 15,
    fontWeight: '900',
    color: COLORS.primaryDark,
  },
});
