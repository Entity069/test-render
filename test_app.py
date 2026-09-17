import unittest
import json
from app import app


class FlaskCommandRunnerTestCase(unittest.TestCase):
    def setUp(self):
        self.app = app
        self.app.config["TESTING"] = True
        self.client = self.app.test_client()

    def test_index_get(self):
        """Test that the index page loads successfully."""
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        self.assertIn(b"Flask Command Runner", response.data)
        self.assertIn(b"commandInput", response.data)

    def test_health_check(self):
        """Test health check endpoint."""
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertEqual(data["status"], "healthy")

    def test_api_execute_success(self):
        """Test executing a simple echo command."""
        response = self.client.post(
            "/api/execute",
            data=json.dumps({"command": 'echo "hello from flask"'}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertEqual(data["returncode"], 0)
        self.assertIn("hello from flask", data["stdout"])
        self.assertEqual(data["stderr"], "")
        self.assertGreaterEqual(data["execution_time"], 0.0)

    def test_api_execute_error(self):
        """Test executing a non-existent command."""
        response = self.client.post(
            "/api/execute",
            data=json.dumps({"command": "some_non_existent_command_xyz_123"}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertNotEqual(data["returncode"], 0)
        self.assertTrue(len(data["stderr"]) > 0 or data["returncode"] != 0)

    def test_api_execute_empty(self):
        """Test submitting an empty command."""
        response = self.client.post(
            "/api/execute",
            data=json.dumps({"command": "   "}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertEqual(data["returncode"], -1)
        self.assertIn("Command cannot be empty", data["stderr"])

    def test_form_post_fallback(self):
        """Test classic form POST submission without JS."""
        response = self.client.post(
            "/",
            data={"command": 'echo "fallback form test"'},
        )
        self.assertEqual(response.status_code, 200)
        self.assertIn(b"fallback form test", response.data)


if __name__ == "__main__":
    unittest.main()
