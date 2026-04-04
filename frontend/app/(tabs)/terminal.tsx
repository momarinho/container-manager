import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { History, Send } from 'lucide-react-native';
import { Colors } from '../../constants/Colors';

export default function TerminalScreen() {
  const [input, setInput] = useState('');

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>CONNECTED</Text>
          <Text style={styles.idText}>ID: 8fa2e1c94b</Text>
        </View>
        <Text style={styles.uptimeText}>UPTIME: 14D 02H</Text>
      </View>

      <View style={styles.terminalContainer}>
        <ScrollView style={styles.terminalScroll} contentContainerStyle={styles.terminalContent}>
          <View style={styles.logRow}>
            <Text style={styles.promptSign}>$</Text>
            <Text style={styles.commandText}>docker exec nginx sh</Text>
          </View>
          
          <View style={styles.logRow}>
            <Text style={styles.promptRoot}>/ #</Text>
            <Text style={styles.commandText}>ls</Text>
          </View>
          
          <View style={styles.lsGrid}>
            <Text style={styles.lsItem}>bin</Text>
            <Text style={styles.lsItem}>dev</Text>
            <Text style={styles.lsItem}>etc</Text>
            <Text style={styles.lsItem}>home</Text>
          </View>
          
          <View style={styles.logRow}>
            <Text style={styles.promptRoot}>/ #</Text>
            <Text style={styles.commandText}>nginx -v</Text>
          </View>
          <Text style={styles.outputText}>nginx version: nginx/1.25.3</Text>

          <View style={styles.logRow}>
            <Text style={styles.promptRoot}>/ #</Text>
            <View style={styles.cursor} />
          </View>
        </ScrollView>
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.inputArea}
      >
        <TouchableOpacity style={styles.historyBtn}>
          <History color={Colors.secondary} size={20} />
        </TouchableOpacity>
        
        <View style={styles.inputWrapper}>
          <Text style={styles.inputPrompt}>/ #</Text>
          <TextInput
            style={styles.input}
            placeholder="Type command..."
            placeholderTextColor="rgba(65, 71, 82, 0.4)" // outline/40
            value={input}
            onChangeText={setInput}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
        
        <TouchableOpacity style={styles.sendBtn}>
          <Send color={Colors.background} size={20} />
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingHorizontal: 16,
    paddingTop: 48,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.tertiary,
    shadowColor: Colors.tertiary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 4,
  },
  statusText: {
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 2,
    color: Colors.secondary,
  },
  idText: {
    fontSize: 10,
    color: Colors.outline,
    letterSpacing: 2,
    marginLeft: 8,
  },
  uptimeText: {
    fontSize: 10,
    color: Colors.outline,
    letterSpacing: 1,
  },
  terminalContainer: {
    flex: 1,
    backgroundColor: '#000',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(65, 71, 82, 0.1)',
    marginBottom: 16,
    overflow: 'hidden',
  },
  terminalScroll: {
    flex: 1,
  },
  terminalContent: {
    padding: 24,
  },
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    marginTop: 16,
  },
  promptSign: {
    color: Colors.primary,
    opacity: 0.8,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  promptRoot: {
    color: Colors.tertiary,
    opacity: 0.8,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  commandText: {
    color: Colors.onSurface,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  lsGrid: {
    flexDirection: 'row',
    gap: 16,
    marginLeft: 24,
    marginTop: 4,
  },
  lsItem: {
    color: Colors.secondary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  outputText: {
    color: Colors.secondary,
    marginLeft: 24,
    marginTop: 4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  cursor: {
    width: 8,
    height: 20,
    backgroundColor: Colors.primary,
  },
  inputArea: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 24,
  },
  historyBtn: {
    padding: 12,
    backgroundColor: Colors.surfaceHigh,
    borderRadius: 12,
  },
  inputWrapper: {
    flex: 1,
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#000',
    borderRadius: 12,
  },
  inputPrompt: {
    position: 'absolute',
    left: 16,
    color: Colors.tertiary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 14,
    zIndex: 1,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    paddingLeft: 48,
    paddingRight: 16,
    color: Colors.onSurface,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 14,
  },
  sendBtn: {
    backgroundColor: Colors.primaryContainer,
    padding: 14,
    borderRadius: 12,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 4,
  },
});
