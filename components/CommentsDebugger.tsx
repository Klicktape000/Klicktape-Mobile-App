import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { supabase } from '../lib/supabase';

const CommentsDebugger = () => {
  const [testResults, setTestResults] = useState<string[]>([]);

  const addResult = (result: string) => {
    setTestResults(prev => [...prev, result]);
  };

  const testSupabaseConnection = async () => {
    try {
      const { data, error } = await supabase.from('profiles').select('id').limit(1);
      if (error) {
        addResult(`❌ Supabase connection failed: ${error.message}`);
      } else {
        addResult(`✅ Supabase connection successful`);
      }
    } catch (__error) {
      addResult(`❌ Supabase connection error: ${__error}`);
    }
  };

  const testFetchComments = async () => {
    try {
      const { data, error } = await supabase
        .from('comments')
        .select(`
          id,
          content,
          created_at,
          user_id,
          post_id,
          profiles:user_id (
            username,
            avatar_url
          )
        `)
        .limit(5);

      if (error) {
        addResult(`❌ Fetch comments failed: ${error.message}`);
      } else {
        addResult(`✅ Fetched ${data?.length || 0} comments successfully`);
        if (data && data.length > 0) {
          addResult(`Sample comment: ${JSON.stringify(data[0], null, 2)}`);
        }
      }
    } catch (__error) {
      addResult(`❌ Fetch comments error: ${__error}`);
    }
  };

  const testCreateComment = async () => {
    try {
      // First get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        addResult(`❌ No authenticated user found`);
        return;
      }

      // Try to create a test comment
      const { data, error } = await (supabase as any)
        .from('comments')
        .insert([{
          content: `Test comment from debugger - ${new Date().toISOString()}`,
          user_id: user.id,
          post_id: 'test-post-id' // This might fail if post doesn't exist
        }])
        .select();

      if (error) {
        addResult(`❌ Create comment failed: ${error.message}`);
      } else {
        addResult(`✅ Created comment successfully: ${(data as any) && (data as any).length > 0 ? (data as any)[0].id : 'No ID returned'}`);
      }
    } catch (__error) {
      addResult(`❌ Create comment error: ${__error}`);
    }
  };

  const clearResults = () => {
    setTestResults([]);
  };

  return (
    <View style={{ flex: 1, padding: 20, backgroundColor: '#f5f5f5' }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' }}>
        Comments Debugger
      </Text>
      
      <View style={{ marginBottom: 20 }}>
        <TouchableOpacity
          onPress={testSupabaseConnection}
          style={{ backgroundColor: '#007AFF', padding: 15, borderRadius: 8, marginBottom: 10 }}
        >
          <Text style={{ color: 'white', textAlign: 'center', fontWeight: 'bold' }}>
            Test Supabase Connection
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={testFetchComments}
          style={{ backgroundColor: '#34C759', padding: 15, borderRadius: 8, marginBottom: 10 }}
        >
          <Text style={{ color: 'white', textAlign: 'center', fontWeight: 'bold' }}>
            Test Fetch Comments
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={testCreateComment}
          style={{ backgroundColor: '#FF9500', padding: 15, borderRadius: 8, marginBottom: 10 }}
        >
          <Text style={{ color: 'white', textAlign: 'center', fontWeight: 'bold' }}>
            Test Create Comment
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={clearResults}
          style={{ backgroundColor: '#FF3B30', padding: 15, borderRadius: 8 }}
        >
          <Text style={{ color: 'white', textAlign: 'center', fontWeight: 'bold' }}>
            Clear Results
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1, backgroundColor: 'white', borderRadius: 8, padding: 15 }}>
        <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 10 }}>Test Results:</Text>
        {testResults.length === 0 ? (
          <Text style={{ fontStyle: 'italic', color: '#666' }}>No tests run yet</Text>
        ) : (
          testResults.map((result, index) => (
            <View key={index}>
              <Text style={{ marginBottom: 8, fontSize: 14, fontFamily: 'monospace' }}>
                {result}
              </Text>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
};

export default CommentsDebugger;

