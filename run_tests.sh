#!/bin/bash
# Test runner script for texhandler

echo "Running texhandler test suite..."
echo "================================"
echo ""

# Run tests with coverage
python3 -m pytest test_app.py -v --tb=short --cov=app --cov-report=term-missing

echo ""
echo "================================"
echo "Test suite completed!"

